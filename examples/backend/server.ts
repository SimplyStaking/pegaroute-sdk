/**
 * Minimal backend using the Pegaroute SDK: your frontend calls these routes, and only this server holds the API key.
 *
 * Run from the repo root, after setting the PEGAROUTE_EXAMPLE_* variables (e.g. in `.env`):
 *   bun run build && bun examples/backend/server.ts
 *
 * Routes:
 *   POST /quote               → quotes.get
 *   POST /swap                → swaps.create (send `execution` to the wallet to sign)
 *   POST /swap/:id/txhash     → swaps.submitTxHash (after the user broadcast the transaction)
 *   GET  /swap/:id            → swaps.get
 *   POST /webhooks/pegaroute  → verifyWebhook (register this URL in the Pegaroute UI)
 */
import {
  type CreateSwapParams,
  type GetQuoteParams,
  Pegaroute,
  PegarouteError,
  ProviderChangedError,
  type SubmitTxHashParams,
  verifyWebhook,
  WebhookVerificationError,
} from "@pegaroute/sdk";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/** Reads a required environment variable, failing at startup rather than on the first request. */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}`);

  return value;
}

const pr = new Pegaroute({
  apiKey: requireEnv("PEGAROUTE_EXAMPLE_API_KEY"),
  baseUrl: requireEnv("PEGAROUTE_EXAMPLE_BASE_URL"),
});

const WEBHOOK_SECRET = requireEnv("PEGAROUTE_EXAMPLE_WEBHOOK_SECRET");

const app = new Hono();

// Request bodies are passed to the SDK as-is to keep the example short. Validate them in a real app.

app.post("/quote", async (c) => c.json(await pr.quotes.get(await c.req.json<GetQuoteParams>())));

app.post("/swap", async (c) => c.json(await pr.swaps.create(await c.req.json<CreateSwapParams>()), 201));

app.post("/swap/:id/txhash", async (c) =>
  c.json(await pr.swaps.submitTxHash(c.req.param("id"), await c.req.json<SubmitTxHashParams>())),
);

app.get("/swap/:id", async (c) => c.json(await pr.swaps.get(c.req.param("id"))));

app.post("/webhooks/pegaroute", async (c) => {
  // Verify against the raw body: parsing and re-serialising it would break the signature.
  try {
    const event = await verifyWebhook({
      rawBody: await c.req.text(),
      signature: c.req.header("x-pegasus-signature"),
      secret: WEBHOOK_SECRET,
    });

    // Delivery is at-least-once, so handle each event idempotently.
    if (event.event === "webhook.test") console.log("Pegaroute test webhook received");
    else console.log(`${event.event}: swap ${event.data.transactionId} is ${event.data.status}`);

    return c.body(null, 200);
  } catch (error) {
    if (error instanceof WebhookVerificationError) return c.body(null, 401);
    throw error;
  }
});

// Turn SDK errors into responses the frontend can show.
app.onError((error, c) => {
  // The quoted route is gone: hand the frontend the new quote to confirm and retry with.
  if (error instanceof ProviderChangedError) {
    return c.json({ error: error.userMessage, newQuote: error.newQuote }, 409);
  }

  // Any other API error: pass on its status, or 502 when Pegaroute couldn't be reached.
  if (error instanceof PegarouteError) {
    return c.json({ error: error.userMessage, code: error.code }, (error.status ?? 502) as ContentfulStatusCode);
  }

  console.error(error);
  return c.json({ error: "Something went wrong." }, 500);
});

export default { port: Number(process.env.PEGAROUTE_EXAMPLE_PORT ?? 8787), fetch: app.fetch };
