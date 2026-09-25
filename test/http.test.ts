import { describe, expect, test } from "bun:test";
import {
  ConnectionError,
  PegarouteError,
  QuoteExpiredError,
  ServiceUnavailableError,
  TimeoutError,
} from "../src/core/errors.js";
import { type Fetch, HttpClient } from "../src/core/http.js";

/** A request the mocked `fetch` received. */
type Call = { url: string; init: RequestInit };

/** A fake `fetch` that returns the given responses in order and records every call. */
function mockFetch(...responses: Response[]): { fetch: Fetch; calls: Call[] } {
  const calls: Call[] = [];

  const fetch: Fetch = async (url, init) => {
    calls.push({ url, init });

    // Fail loudly if the code under test makes more requests than the test expects.
    const response = responses.shift();
    if (!response) throw new Error("unexpected request");

    return response;
  };

  return { fetch, calls };
}

/** An `HttpClient` with test defaults; override only what a test cares about. */
function client(fetch: Fetch, overrides: { timeoutMs?: number; maxRetries?: number } = {}): HttpClient {
  return new HttpClient({
    apiKey: "pegasus-test",
    baseUrl: "https://api.test",
    timeoutMs: 1_000,
    maxRetries: 2,
    fetch,
    ...overrides,
  });
}

/** A response shaped like Pegaroute's error envelope: `{ error: { … } }`. */
function errorResponse(status: number, error: Record<string, unknown>, headers: Record<string, string> = {}): Response {
  return Response.json({ error }, { status, headers });
}

describe("HttpClient", () => {
  test("sends the API key and serialises query params, skipping undefined", async () => {
    // Arrange: one successful response.
    const { fetch, calls } = mockFetch(Response.json({ ok: true }));

    // Act: a GET with a mix of string, boolean and undefined query params.
    const result = await client(fetch).request<{ ok: boolean }>({
      method: "GET",
      path: "/quote",
      query: { fromChain: "ETH", amount: "0.5", private: false, senderAddress: undefined },
    });

    // Assert: body parsed, undefined param dropped, API key header sent.
    expect(result).toEqual({ ok: true });

    const [call] = calls;
    expect(call?.url).toBe("https://api.test/quote?fromChain=ETH&amount=0.5&private=false");
    expect(new Headers(call?.init.headers).get("X-API-Key")).toBe("pegasus-test");
  });

  test("maps the error envelope to the matching subclass", async () => {
    // Arrange: a 410 QUOTE_EXPIRED error from the server.
    const { fetch } = mockFetch(
      errorResponse(410, { code: "QUOTE_EXPIRED", message: "expired", userMessage: "Quote expired", retryable: false }),
    );

    // Act
    const error = await client(fetch)
      .request({ method: "POST", path: "/swap", body: {} })
      .catch((e) => e);

    // Assert: the 410 becomes a QuoteExpiredError carrying the envelope's fields.
    expect(error).toBeInstanceOf(QuoteExpiredError);
    expect(error).toMatchObject({ code: "QUOTE_EXPIRED", status: 410, userMessage: "Quote expired", retryable: false });
  });

  test("retries GET on 503 honouring Retry-After", async () => {
    // Arrange: a 503 asking to retry immediately, then a success.
    const unavailable = { code: "PROVIDER_UNAVAILABLE", message: "down", retryable: true };
    const { fetch, calls } = mockFetch(
      errorResponse(503, unavailable, { "Retry-After": "0" }),
      Response.json({ ok: true }),
    );

    // Act
    const result = await client(fetch).request({ method: "GET", path: "/chains" });

    // Assert: the retry succeeds, after exactly two requests.
    expect(result).toEqual({ ok: true });
    expect(calls).toHaveLength(2);
  });

  test("never retries POST", async () => {
    // Arrange: the same retryable 503, but on a POST.
    const { fetch, calls } = mockFetch(
      errorResponse(503, { code: "PROVIDER_UNAVAILABLE", message: "down" }, { "Retry-After": "0" }),
    );

    // Act
    const error = await client(fetch)
      .request({ method: "POST", path: "/swap", body: {} })
      .catch((e) => e);

    // Assert: the error is thrown straight away, after a single request.
    expect(error).toBeInstanceOf(ServiceUnavailableError);
    expect(calls).toHaveLength(1);
  });

  test("gives up immediately when Retry-After exceeds 60s", async () => {
    // Arrange: a 429 asking us to wait two minutes.
    const { fetch, calls } = mockFetch(
      errorResponse(429, { code: "RATE_LIMITED", message: "slow down" }, { "Retry-After": "120" }),
    );

    // Act
    const error = await client(fetch)
      .request({ method: "GET", path: "/chains" })
      .catch((e) => e);

    // Assert: no waiting, no retry — the rate-limit error is thrown after one request.
    expect(error).toMatchObject({ code: "RATE_LIMITED", status: 429 });
    expect(calls).toHaveLength(1);
  });

  test("throws TimeoutError when the request exceeds timeoutMs", async () => {
    // Arrange: a fetch that never answers, only rejects when aborted.
    const hangingFetch: Fetch = (_url, init) =>
      new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason)));

    // Act
    const error = await client(hangingFetch, { timeoutMs: 20, maxRetries: 0 })
      .request({ method: "GET", path: "/chains" })
      .catch((e) => e);

    // Assert: after 20ms our timeout fires and becomes a TimeoutError.
    expect(error).toBeInstanceOf(TimeoutError);
  });

  test("keeps the real status when the connection drops while reading the body", async () => {
    // Arrange: a 200 whose body stream fails mid-download.
    const brokenBody = new ReadableStream({ start: (controller) => controller.error(new TypeError("terminated")) });
    const { fetch } = mockFetch(new Response(brokenBody, { status: 200 }));

    // Act
    const error = await client(fetch, { maxRetries: 0 })
      .request({ method: "GET", path: "/chains" })
      .catch((e) => e);

    // Assert: still a ConnectionError, but the status that did arrive is reported.
    expect(error).toBeInstanceOf(ConnectionError);
    expect(error).toMatchObject({ code: "CONNECTION_ERROR", status: 200 });
  });

  test("throws INVALID_RESPONSE when a 2xx body is not JSON", async () => {
    // Arrange: a 200 with an HTML body, e.g. from a misconfigured proxy.
    const { fetch } = mockFetch(new Response("<html>proxy</html>", { status: 200 }));

    // Act
    const error = await client(fetch)
      .request({ method: "GET", path: "/chains" })
      .catch((e) => e);

    // Assert
    expect(error).toBeInstanceOf(PegarouteError);
    expect(error).toMatchObject({ code: "INVALID_RESPONSE", status: 200 });
  });
});
