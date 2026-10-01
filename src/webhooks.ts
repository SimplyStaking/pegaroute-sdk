import type { WebhookEvent } from "./types/webhooks.js";

/** Why {@link verifyWebhook} rejected a delivery. */
export type WebhookVerificationFailure = "missing_signature" | "invalid_signature" | "invalid_payload";

/**
 * A webhook delivery failed verification: don't trust its body. Answer with a 4xx (e.g. 401).
 *
 * Not a `PegarouteError`: no API request was made, so its HTTP fields wouldn't mean anything.
 */
export class WebhookVerificationError extends Error {
  /**
   * What was wrong:
   * - `missing_signature`: no `X-Pegasus-Signature` header.
   * - `invalid_signature`: the signature doesn't match the body and secret (wrong secret, altered body, or the
   *   body was re-serialised instead of passed raw).
   * - `invalid_payload`: the signature matched, but the body isn't a JSON object.
   */
  readonly reason: WebhookVerificationFailure;

  constructor(reason: WebhookVerificationFailure, message: string, options?: ErrorOptions) {
    super(message, options);

    this.name = "WebhookVerificationError";
    this.reason = reason;
  }
}

/** What {@link verifyWebhook} needs from a delivery. */
export interface VerifyWebhookParams {
  /**
   * The request body exactly as received: the signature covers these bytes, so parse it only afterwards.
   * A Node `Buffer` is a `Uint8Array`, so it works as-is.
   */
  rawBody: string | Uint8Array;

  /**
   * The `X-Pegasus-Signature` header. Typed loosely so header values pass straight through:
   * `req.headers["x-pegasus-signature"]` (Node/Express) or `request.headers.get("x-pegasus-signature")` (fetch).
   */
  signature: string | string[] | null | undefined;

  /** Your integration's webhook secret: the full `whsec_…` value from the Pegaroute UI. */
  secret: string;
}

/** Optional prefix some senders put before the hex digest. Pegaroute sends bare hex today; both are accepted. */
const SIGNATURE_PREFIX = "sha256=";

/** An HMAC-SHA256 digest in hex: 32 bytes = 64 characters. */
const HEX_DIGEST = /^[0-9a-f]{64}$/i;

/**
 * Checks that a webhook came from Pegaroute and returns its typed event.
 *
 * The signature is an HMAC-SHA256 of the raw body, keyed with your webhook secret. Delivery is at-least-once, so
 * the same event can arrive more than once: make handlers idempotent.
 *
 * Throws `WebhookVerificationError` when the delivery can't be trusted, and `TypeError` for a coding mistake
 * (`secret` missing, or `signature` neither a string nor an array).
 *
 * @example
 * app.post("/webhooks/pegaroute", express.raw({ type: "application/json" }), async (req, res) => {
 *   try {
 *     const event = await verifyWebhook({
 *       rawBody: req.body,
 *       signature: req.headers["x-pegasus-signature"],
 *       secret: process.env.PEGAROUTE_WEBHOOK_SECRET!,
 *     });
 *     if (event.event === "transaction.completed") markPaid(event.data.transactionId);
 *     res.sendStatus(200);
 *   } catch (e) {
 *     if (e instanceof WebhookVerificationError) return res.sendStatus(401);
 *     throw e;
 *   }
 * });
 */
export async function verifyWebhook(params: VerifyWebhookParams): Promise<WebhookEvent> {
  const { rawBody, signature, secret } = params;

  // Validate the secret: a missing one is a setup mistake, not a bad delivery.
  if (typeof secret !== "string" || secret.trim() === "") {
    throw new TypeError("Pegaroute: `secret` is required to verify webhooks");
  }

  // Read the signature header.
  if (signature === undefined || signature === null || signature === "") {
    throw new WebhookVerificationError("missing_signature", "Missing X-Pegasus-Signature header");
  }

  // Several values: the header arrived more than once, and we can't tell which one to trust.
  if (Array.isArray(signature)) {
    throw new WebhookVerificationError("invalid_signature", "Received more than one X-Pegasus-Signature header");
  }

  // Anything else that isn't a string is a coding mistake, not a bad delivery (like a missing `secret`).
  if (typeof signature !== "string") {
    throw new TypeError(`Pegaroute: \`signature\` must be a string, received ${typeof signature}`);
  }

  // Accept bare hex (what Pegaroute sends) or `sha256=<hex>`.
  const digest = signature.startsWith(SIGNATURE_PREFIX) ? signature.slice(SIGNATURE_PREFIX.length) : signature;
  if (!HEX_DIGEST.test(digest)) {
    throw new WebhookVerificationError("invalid_signature", "X-Pegasus-Signature is not an HMAC-SHA256 hex digest");
  }

  // Check the HMAC over the exact bytes received. `subtle.verify` compares in constant time.
  // A `Uint8Array` is copied because Web Crypto rejects views over a `SharedArrayBuffer`.
  const bodyBytes = typeof rawBody === "string" ? new TextEncoder().encode(rawBody) : new Uint8Array(rawBody);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const valid = await crypto.subtle.verify("HMAC", key, hexToBytes(digest), bodyBytes);
  if (!valid) {
    throw new WebhookVerificationError(
      "invalid_signature",
      "X-Pegasus-Signature does not match the body. Check that `secret` is the integration's current webhook secret, " +
        "and that `rawBody` is the body exactly as received (not parsed and re-serialised).",
    );
  }

  // The body is authentic: parse it.
  const bodyText = typeof rawBody === "string" ? rawBody : new TextDecoder().decode(rawBody);

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch (cause) {
    throw new WebhookVerificationError("invalid_payload", "Webhook body is not valid JSON", { cause });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new WebhookVerificationError("invalid_payload", "Webhook body is not a JSON object");
  }

  return body as WebhookEvent;
}

/** Converts a hex string (already checked to be valid, even-length hex) to bytes. */
function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);

  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  return bytes;
}
