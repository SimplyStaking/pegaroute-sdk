import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { verifyWebhook, WebhookVerificationError, type WebhookVerificationFailure } from "../src/webhooks.js";

const SECRET = "whsec_test_secret";

/** A `webhook.test` delivery body, as Pegaroute serialises it. */
const BODY = JSON.stringify({
  event: "webhook.test",
  timestamp: "2026-10-01T12:00:00.000Z",
  data: { integrationId: "int_1", message: "Pegaroute test webhook", generatedBy: "ops@example.com" },
});

/** Signs a body the way Pegaroute does (bare hex HMAC-SHA256), with Node's own crypto as an independent check. */
function sign(body: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/** Captures the error a promise rejects with (`toThrow` alone compares only the message, not the class). */
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error("expected the promise to reject");
}

describe("verifyWebhook", () => {
  test.each([
    ["a string body and bare hex", BODY, sign(BODY)],
    ["a Buffer body", Buffer.from(BODY), sign(BODY)],
    ["a sha256= prefix", BODY, `sha256=${sign(BODY)}`],
    ["an uppercase digest", BODY, sign(BODY).toUpperCase()],
  ])("returns the parsed event for %s", async (_, rawBody, signature) => {
    // Act
    const event = await verifyWebhook({ rawBody, signature, secret: SECRET });

    // Assert
    expect(event).toEqual(JSON.parse(BODY));
  });

  test.each<[string, string | string[] | undefined, string, WebhookVerificationFailure]>([
    ["no signature", undefined, BODY, "missing_signature"],
    ["more than one signature header", [sign(BODY), sign(BODY)], BODY, "invalid_signature"],
    ["a signature that isn't hex", "not-a-signature", BODY, "invalid_signature"],
    ["a signature made with another secret", sign(BODY, "whsec_other"), BODY, "invalid_signature"],
    ["a body changed after signing", sign(BODY), BODY.replace("int_1", "int_2"), "invalid_signature"],
    ["a correctly signed body that isn't JSON", sign("not json"), "not json", "invalid_payload"],
  ])("rejects %s", async (_, signature, rawBody, reason) => {
    // Act
    const error = await rejection(verifyWebhook({ rawBody, signature, secret: SECRET }));

    // Assert: the right error class and reason, so handlers can tell the cases apart.
    expect(error).toBeInstanceOf(WebhookVerificationError);
    expect((error as WebhookVerificationError).reason).toBe(reason);
  });

  test("throws a TypeError when the secret is missing", async () => {
    // Act: an unset env var, cast through to bypass the type.
    const error = await rejection(verifyWebhook({ rawBody: BODY, signature: sign(BODY), secret: undefined as never }));

    // Assert: a setup mistake, not a bad delivery.
    expect(error).toBeInstanceOf(TypeError);
  });
});
