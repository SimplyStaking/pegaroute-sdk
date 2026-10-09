import { describe, expect, test } from "bun:test";
import {
  ConflictError,
  ConnectionError,
  InternalServerError,
  PegarouteError,
  ProviderChangedError,
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

/** A fetch that never answers; it only rejects (with the signal's reason) once the request is aborted. */
const hangingFetch: Fetch = (_url, init) =>
  new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason)));

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

  test("rejects an invalid per-call timeout with a RangeError, before sending anything", async () => {
    // Arrange: a fetch that would answer, if it were ever called.
    const { fetch, calls } = mockFetch(Response.json({ ok: true }));

    // Act: a fractional timeout, which `AbortSignal.timeout` would otherwise reject with Node's own error.
    const error = await client(fetch)
      .request({ method: "GET", path: "/chains" }, { timeoutMs: 1500.5 })
      .catch((e) => e);

    // Assert: our RangeError, and no request made.
    expect(error).toBeInstanceOf(RangeError);
    expect(error).toMatchObject({ message: "Pegaroute: `timeoutMs` must be a whole number, received 1500.5" });
    expect(calls).toHaveLength(0);
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

  test("maps a 409 PROVIDER_CHANGED to ProviderChangedError with the refreshed quote", async () => {
    // Arrange: Pegaroute's 409 body, with the new quote and providers next to the error envelope.
    const newQuote = { quoteId: "q-2", expiresAt: "2026-09-30T12:00:00.000Z", routes: [], warnings: [] };
    const { fetch } = mockFetch(
      Response.json(
        {
          error: { code: "PROVIDER_CHANGED", message: "changed", userMessage: "Route changed", retryable: false },
          newQuote,
          originalProvider: "maya",
          newProvider: "thorchain",
        },
        { status: 409 },
      ),
    );

    // Act
    const error = await client(fetch)
      .request({ method: "POST", path: "/swap", body: {} })
      .catch((e) => e);

    // Assert: a ConflictError subclass carrying the refreshed quote and both providers.
    expect(error).toBeInstanceOf(ProviderChangedError);
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({
      code: "PROVIDER_CHANGED",
      status: 409,
      newQuote,
      originalProvider: "maya",
      newProvider: "thorchain",
    });
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

  test("retries GET after a network failure", async () => {
    // Arrange: the first attempt fails at the network level, the second succeeds.
    let attempts = 0;
    const flakyFetch: Fetch = async () => {
      attempts++;
      // A real `fetch` rejects with a TypeError when no response arrives (e.g. "fetch failed" in Node,
      // "Failed to fetch" in browsers). HTTP error statuses never throw; they resolve as responses.
      if (attempts === 1) throw new TypeError("fetch failed");

      return Response.json({ ok: true });
    };

    // Act
    const result = await client(flakyFetch).request({ method: "GET", path: "/chains" });

    // Assert: the ConnectionError was retried after backoff, and the second attempt's body is returned.
    expect(result).toEqual({ ok: true });
    expect(attempts).toBe(2);
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
    // Act: the server never answers.
    const error = await client(hangingFetch, { timeoutMs: 20, maxRetries: 0 })
      .request({ method: "GET", path: "/chains" })
      .catch((e) => e);

    // Assert: after 20ms our timeout fires and becomes a TimeoutError.
    expect(error).toBeInstanceOf(TimeoutError);
  });

  test("propagates the caller's abort unchanged, without retrying", async () => {
    // Arrange: count attempts, and have the caller cancel shortly after the request starts.
    let attempts = 0;
    const countingHangingFetch: Fetch = (url, init) => {
      attempts++;
      return hangingFetch(url, init);
    };

    const controller = new AbortController();
    const reason = new Error("cancelled by caller");
    setTimeout(() => controller.abort(reason), 10);

    // Act
    const error = await client(countingHangingFetch)
      .request({ method: "GET", path: "/chains" }, { signal: controller.signal })
      .catch((e) => e);

    // Assert: the caller gets their own abort reason back (not a TimeoutError), after one attempt.
    expect(error).toBe(reason);
    expect(attempts).toBe(1);
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

  test("returns the body for a success status like /health's 503, without retrying", async () => {
    // Arrange: a degraded health body sent with 503.
    const { fetch, calls } = mockFetch(Response.json({ status: "degraded" }, { status: 503 }));

    // Act
    const result = await client(fetch).request({ method: "GET", path: "/health", successStatuses: [503] });

    // Assert: body returned after a single attempt.
    expect(result).toEqual({ status: "degraded" });
    expect(calls).toHaveLength(1);
  });

  test("still retries, then throws, when a success status carries an error envelope", async () => {
    // Arrange: a real 503 error from the server twice, on an endpoint that accepts 503 bodies.
    const error503 = () =>
      errorResponse(
        503,
        { code: "PROVIDER_UNAVAILABLE", message: "down", userMessage: "Unavailable", retryable: true },
        { "Retry-After": "0" },
      );
    const { fetch, calls } = mockFetch(error503(), error503());

    // Act: allow one retry.
    const error = await client(fetch, { maxRetries: 1 })
      .request({ method: "GET", path: "/health", successStatuses: [503] })
      .catch((e) => e);

    // Assert: handled like any 503, i.e. retried once, then thrown.
    expect(calls).toHaveLength(2);
    expect(error).toBeInstanceOf(ServiceUnavailableError);
    expect(error).toMatchObject({ code: "PROVIDER_UNAVAILABLE", status: 503 });
  });

  test("does not retry a 503 whose error body says retryable: false", async () => {
    // Arrange: a disabled chain, which the server marks as not worth retrying.
    const { fetch, calls } = mockFetch(
      errorResponse(503, { code: "CHAIN_DISABLED", message: "disabled", retryable: false }, { "Retry-After": "0" }),
    );

    // Act: retries are allowed, but the server's flag should win.
    const error = await client(fetch)
      .request({ method: "GET", path: "/quote" })
      .catch((e) => e);

    // Assert: thrown after a single attempt.
    expect(calls).toHaveLength(1);
    expect(error).toBeInstanceOf(ServiceUnavailableError);
    expect(error).toMatchObject({ code: "CHAIN_DISABLED", retryable: false });
  });

  test("retries a proxy's 502 page, and reports the same retryable: true it acted on", async () => {
    // Arrange: a proxy's HTML error page twice (no Pegaroute error body, so no `retryable` flag).
    const proxyPage = () => new Response("<html>Bad Gateway</html>", { status: 502, headers: { "Retry-After": "0" } });
    const { fetch, calls } = mockFetch(proxyPage(), proxyPage());

    // Act: allow one retry.
    const error = await client(fetch, { maxRetries: 1 })
      .request({ method: "GET", path: "/chains" })
      .catch((e) => e);

    // Assert: retried once because of its status, and the thrown error says so too.
    expect(calls).toHaveLength(2);
    expect(error).toBeInstanceOf(InternalServerError);
    expect(error).toMatchObject({ code: "UNKNOWN_ERROR", status: 502, retryable: true });
  });
});
