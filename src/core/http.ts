import {
  ConnectionError,
  errorFromResponse,
  isPegarouteErrorEnvelope,
  PegarouteError,
  TimeoutError,
} from "./errors.js";
import { assertIntegerAtLeast } from "./validation.js";

/** Per-call options accepted by every SDK method. */
export interface RequestOptions {
  /** Cancels the request (and any pending retry). Cancellation is never retried. */
  signal?: AbortSignal;

  /** Overrides the client's `timeoutMs` for this call. */
  timeoutMs?: number;
}

/** Minimal `fetch` signature the SDK needs; any standard `fetch` satisfies it. */
export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** Resolved client settings the HTTP layer works with (defaults already applied). */
export interface HttpClientConfig {
  /** Integration API key, sent as the `X-API-Key` header. */
  apiKey: string;

  /** Base URL without a trailing slash. */
  baseUrl: string;

  /** Default per-request timeout in milliseconds. */
  timeoutMs: number;

  /** How many times a GET may be retried after the first attempt. */
  maxRetries: number;

  /** The `fetch` implementation used to send requests. */
  fetch: Fetch;
}

/** Query string values; `undefined` entries are left out of the URL. */
export type QueryParams = Record<string, string | number | boolean | undefined>;

/** One API call, described independently of how it is sent. */
export interface HttpRequest {
  method: "GET" | "POST";

  /** Endpoint path starting with `/`, e.g. `/quote`. */
  path: string;

  query?: QueryParams;

  /** JSON body; serialised with `JSON.stringify`. */
  body?: unknown;

  /**
   * Non-2xx statuses that still carry a normal response body, e.g. `/health` answers 503 when degraded.
   * That body is returned (never retried) unless it isn't JSON or is an error envelope, which are handled as usual.
   */
  successStatuses?: number[];
}

/** HTTP statuses worth retrying: rate limited, or temporarily unavailable. */
const RETRYABLE_STATUSES = new Set([429, 503]);

/** If the server asks us to wait longer than this, give up instead of blocking the caller. */
const MAX_RETRY_AFTER_SECONDS = 60;

/** Exponential backoff bounds, used when the server doesn't send `Retry-After`. */
const INITIAL_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8_000;

/** Sends requests to the Pegaroute API: auth, timeouts, retries and error mapping. */
export class HttpClient {
  readonly #config: HttpClientConfig;

  constructor(config: HttpClientConfig) {
    this.#config = config;
  }

  /** Sends a request, retrying GETs on 429/503/connection errors. */
  async request<T>(request: HttpRequest, options: RequestOptions = {}): Promise<T> {
    // Validate the per-call timeout before sending anything (the client's default was checked at construction).
    if (options.timeoutMs !== undefined) assertIntegerAtLeast("timeoutMs", options.timeoutMs, 1);

    // Only GETs are safe to repeat; a retried POST /swap could create a duplicate swap. Even though this is safe in Pegasus as the user only signs one swap at a time, we still enforce this rule to prevent accidental duplicate requests.
    const maxRetries = request.method === "GET" ? this.#config.maxRetries : 0;

    for (let attempt = 0; ; attempt++) {
      // Send one attempt. Network failures and timeouts are retried with backoff; anything else is thrown.
      let response: Response;
      let bodyText: string;
      try {
        ({ response, bodyText } = await this.#send(request, options));
      } catch (error) {
        if (!(error instanceof ConnectionError) || attempt >= maxRetries) throw error;

        await sleep(backoffMs(attempt), options.signal);
        continue;
      }

      // Success: return the parsed JSON body.
      if (response.ok) return parseJson<T>(response, bodyText);

      // Some endpoints report their state with a non-2xx status and a normal body (e.g. `/health` → 503).
      // Return that body, unless it is actually an error: not JSON (e.g. a proxy page) or Pegaroute's error envelope.
      if (request.successStatuses?.includes(response.status)) {
        const body = tryParseJson(bodyText);
        if (body !== undefined && !isPegarouteErrorEnvelope(body)) return body as T;
      }

      // Failure: build the typed error, then decide whether this status is worth another attempt.
      const error = errorFromResponse(response, bodyText);
      if (attempt >= maxRetries || !RETRYABLE_STATUSES.has(response.status)) throw error;

      // The server can rule a retry out, e.g. a disabled chain answers 503 with `retryable: false` in its error body.
      if (serverForbidsRetry(bodyText)) throw error;

      // Get the amount of time to wait before retrying. This considers the `Retry-After` header and exponential backoff as fallback.
      const delayMs = retryDelayMs(response, error, attempt);
      if (delayMs === null) throw error;

      await sleep(delayMs, options.signal);
    }
  }

  /** Performs one attempt, including reading the body, under the timeout. */
  async #send(request: HttpRequest, options: RequestOptions): Promise<{ response: Response; bodyText: string }> {
    // Abort on whichever comes first: the timeout or the caller's own signal.
    const timeoutMs = options.timeoutMs ?? this.#config.timeoutMs;
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;

    // Authenticate with the API key; only declare a JSON content type when there is a body.
    const headers: Record<string, string> = { Accept: "application/json", "X-API-Key": this.#config.apiKey };
    if (request.body !== undefined) headers["Content-Type"] = "application/json";

    // Kept outside the `try` so a failure while reading the body can still report the real HTTP status.
    let response: Response | undefined;

    try {
      response = await this.#config.fetch(buildUrl(this.#config.baseUrl, request.path, request.query), {
        method: request.method,
        headers,
        ...(request.body !== undefined && { body: JSON.stringify(request.body) }),
        signal,
      });

      // Read the body here too, so a timeout while downloading it is handled the same way.
      return { response, bodyText: await response.text() };
    } catch (error) {
      // The caller's own cancellation propagates unchanged.
      if (options.signal?.aborted) throw options.signal.reason;

      // `null` if no response arrived at all; the real status if it failed while reading the body.
      const status = response?.status ?? null;

      // Our timeout fired.
      if (timeoutSignal.aborted) {
        throw new TimeoutError({
          code: "TIMEOUT",
          status,
          message: `Request timed out after ${timeoutMs}ms`,
          userMessage: "The request took too long. Please try again.",
          retryable: true,
          cause: error,
        });
      }

      // Anything else is a network failure: either no response arrived (DNS, TCP, TLS, …),
      // or the connection dropped while the body was downloading.
      // HTTP error statuses (4xx/5xx) never get here: `fetch` resolves for those and `request()` handles them.
      throw new ConnectionError({
        code: "CONNECTION_ERROR",
        status,
        message: error instanceof Error ? error.message : "Connection failed",
        userMessage: "Could not reach Pegaroute. Please try again.",
        retryable: true,
        cause: error,
      });
    }
  }
}

/** Joins base URL and path, and appends the defined query params. */
function buildUrl(baseUrl: string, path: string, query: QueryParams | undefined): string {
  const url = new URL(baseUrl + path);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  return url.toString();
}

/** Parses a successful response body; a non-JSON body (e.g. a proxy page) becomes `INVALID_RESPONSE`. */
function parseJson<T>(response: Response, bodyText: string): T {
  try {
    return JSON.parse(bodyText) as T;
  } catch (cause) {
    throw new PegarouteError({
      code: "INVALID_RESPONSE",
      status: response.status,
      message: `Expected a JSON response but received: ${bodyText.slice(0, 100)}`,
      userMessage: "Something went wrong. Please try again.",
      retryable: false,
      details: { body: bodyText.slice(0, 500) },
      cause,
    });
  }
}

/** Parses JSON, returning `undefined` instead of throwing when the text isn't valid JSON. */
function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Whether the body is Pegaroute's error envelope with an explicit `retryable: false`.
 * A body without the envelope (e.g. a proxy page) or without the flag doesn't forbid a retry.
 */
function serverForbidsRetry(bodyText: string): boolean {
  const body = tryParseJson(bodyText);
  return isPegarouteErrorEnvelope(body) && body.error.retryable === false;
}

/** Retry-After (header, then body) wins; `null` means the wait is too long to retry. */
function retryDelayMs(response: Response, error: PegarouteError, attempt: number): number | null {
  const retryAfterSeconds = parseRetryAfter(response.headers.get("retry-after")) ?? error.retryAfterSeconds;

  // No hint from the server: fall back to exponential backoff.
  if (retryAfterSeconds === null) return backoffMs(attempt);

  // Too long to wait inside a single SDK call: let the caller decide.
  if (retryAfterSeconds > MAX_RETRY_AFTER_SECONDS) return null;

  return retryAfterSeconds * 1000;
}

/** Parses `Retry-After` as delta-seconds or an HTTP date. */
function parseRetryAfter(header: string | null): number | null {
  if (header === null) return null;

  // Most servers send a number of seconds, e.g. "5".
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds);

  // The spec also allows an HTTP date, e.g. "Wed, 21 Oct 2026 07:28:00 GMT".
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, (date - Date.now()) / 1000);
}

/** Exponential backoff (0.5s, 1s, 2s … capped at 8s) with ±25% jitter so clients don't retry in lockstep. */
function backoffMs(attempt: number): number {
  const base = Math.min(INITIAL_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);

  return base * (0.75 + Math.random() * 0.5);
}

/** Waits `ms`, but stops early (rejecting) if the caller's signal aborts. */
function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    function onAbort(): void {
      clearTimeout(timer);
      reject(signal?.reason);
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
