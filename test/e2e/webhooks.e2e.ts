/**
 * Real webhook deliveries from Pegaroute, received by a local server and checked with `verifyWebhook`.
 *
 * Pegaroute delivers to the receiver at `PEGAROUTE_E2E_WEBHOOK_HOST`: `host.docker.internal` (the default) when it runs
 * in Docker, `localhost` when it runs directly on this machine. For the run, the receiver's URL is added to the
 * integration's webhook URLs, and the original list is restored afterwards.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { verifyWebhook, type WebhookEvent } from "../../src/index.js";
import { assertShape } from "./assert-shape.js";
import { webhookEventShape } from "./response-shapes.js";
import { operator, pr } from "./setup.js";
import { createTestSwap } from "./test-swap.js";

/** The integration's webhook secret (`whsec_…`), copied once from the Pegaroute UI. Tests never rotate it. */
const SECRET = process.env.PEGAROUTE_E2E_WEBHOOK_SECRET;

/** Where the receiver listens, and the host Pegaroute uses to reach it (`localhost` if Pegaroute isn't in Docker). */
const PORT = Number(process.env.PEGAROUTE_E2E_WEBHOOK_PORT ?? 4010);
const HOST = process.env.PEGAROUTE_E2E_WEBHOOK_HOST ?? "host.docker.internal";
const RECEIVER_URL = `http://${HOST}:${PORT}/webhooks`;

/**
 * How long to wait for a delivery. Pegaroute's webhook worker runs every 5 s (fixed, not configurable) and delivers at
 * most 10 queued webhooks per run, so with other webhooks queued ahead of ours it can take a few runs.
 */
const DELIVERY_TIMEOUT_MS = 30_000;

/** A delivery as received: the raw body bytes and the signature header, untouched. */
interface Delivery {
  rawBody: Uint8Array;
  signature: string | null;
}

/** Every delivery the receiver got during the run. */
const deliveries: Delivery[] = [];

let server: ReturnType<typeof Bun.serve> | undefined;

/** The integration's webhook URLs before the run, restored afterwards. */
let originalWebhookUrls: string[] = [];

/**
 * Waits until a delivery verifies and matches `isExpected`, and returns its event.
 * Every delivery is signed with the same secret, so a delivery that fails verification fails the test.
 */
async function waitForEvent(isExpected: (event: WebhookEvent) => boolean): Promise<WebhookEvent> {
  const deadline = Date.now() + DELIVERY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    for (const delivery of deliveries) {
      const event = await verifyWebhook({ ...delivery, secret: SECRET as string });
      if (isExpected(event)) return event;
    }

    await Bun.sleep(250);
  }

  throw new Error(`No matching webhook within ${DELIVERY_TIMEOUT_MS} ms (${deliveries.length} received)`);
}

describe("webhooks", () => {
  beforeAll(async () => {
    // Fail fast on missing configuration.
    if (!SECRET) {
      throw new Error(
        "E2E setup: set PEGAROUTE_E2E_WEBHOOK_SECRET (e.g. in .env) to the integration's webhook secret.",
      );
    }

    // Start the receiver: keep each body as raw bytes, exactly as a real webhook handler.
    server = Bun.serve({
      port: PORT,
      fetch: async (request) => {
        deliveries.push({
          rawBody: new Uint8Array(await request.arrayBuffer()),
          signature: request.headers.get("x-pegasus-signature"),
        });

        return new Response(null, { status: 200 });
      },
    });

    // Point the integration at the receiver, keeping its existing URLs (minus any leftover from an aborted run).
    const { integrations } = await operator.request<{ integrations: Array<{ id: string; webhookUrls: string[] }> }>(
      "GET",
      "/integrations",
    );

    const integration = integrations.find((candidate) => candidate.id === operator.integrationId);
    originalWebhookUrls = (integration?.webhookUrls ?? []).filter((url) => url !== RECEIVER_URL);

    await operator.request("PATCH", `/integrations/${operator.integrationId}`, {
      webhookUrls: [...originalWebhookUrls, RECEIVER_URL],
    });
  });

  afterAll(async () => {
    // Restore the integration's webhook URLs, then stop the receiver.
    await operator.request("PATCH", `/integrations/${operator.integrationId}`, { webhookUrls: originalWebhookUrls });

    server?.stop(true);
  });

  test("webhook.test: a real delivery verifies and matches the types", async () => {
    // Act: ask Pegaroute to send a test webhook.
    await operator.request("POST", `/integrations/${operator.integrationId}/webhook-test/send`, {});

    const event = await waitForEvent(
      (candidate) => candidate.event === "webhook.test" && candidate.data.integrationId === operator.integrationId,
    );

    // Assert
    assertShape(event, webhookEventShape);
  });

  test("transaction.status_changed: a swap's status change is delivered and verifies", async () => {
    // Act: create a swap and report a (made-up) tx hash, which moves it from pending to submitted.
    const { created } = await createTestSwap();
    const txHash = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`;

    await pr.swaps.submitTxHash(created.transactionId, { txHash });

    const event = await waitForEvent(
      (candidate) =>
        candidate.event === "transaction.status_changed" && candidate.data.transactionId === created.transactionId,
    );

    // Assert: the event matches the types and describes the change we caused.
    assertShape(event, webhookEventShape);
    expect(event.data).toMatchObject({ internalStatus: "submitted", internalPreviousStatus: "pending" });
  });
});
