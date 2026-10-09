import type { QuoteResponse } from "../types/quotes.js";
import type { GetSwapResponse } from "../types/swaps.js";

/** Error codes Pegaroute is known to return. Other strings may appear as the API evolves. */
export type KnownErrorCode =
  // Server-side error codes returned by the Pegaroute API.
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "UNSUPPORTED_PAIR"
  | "AMOUNT_TOO_LOW"
  | "INVALID_ADDRESS"
  | "INVALID_AMOUNT"
  | "QUOTE_MISMATCH"
  | "QUOTE_EXPIRED"
  | "PROVIDER_REJECTED"
  | "PROVIDER_CHANGED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "MEMO_TOO_LONG"
  | "SLIPPAGE_EXCEEDED"
  | "RATE_LIMITED"
  | "CHAIN_HALTED"
  | "CHAIN_DISABLED"
  | "MISSING_QUOTE_DATA"
  | "BROADCAST_FAILED"
  | "INTERNAL_ERROR"

  // Produced by the SDK itself, never by the server.
  | "CONNECTION_ERROR"
  | "TIMEOUT"
  | "INVALID_RESPONSE"
  | "WAIT_TIMEOUT"
  | "UNKNOWN_ERROR";

// Any error code, including unknown ones returned by the API as it evolves.
export type ErrorCode = KnownErrorCode | (string & {});

/**
 * The data needed to create a {@link PegarouteError} ("Init" = initialisation).
 *
 * Passed as one object with named fields instead of many positional arguments, so fields can't be
 * mixed up. Only the SDK creates these errors; integrators just read the same fields on the error they catch.
 *
 * @example
 * new QuoteExpiredError({ code: "QUOTE_EXPIRED", status: 410, message: "…", userMessage: "…", retryable: false });
 */
export interface PegarouteErrorInit {
  /** Machine-readable error code, e.g. `QUOTE_EXPIRED`. */
  code: ErrorCode;

  /** HTTP status, or `null` when no response was received. */
  status: number | null;

  /** Technical message for developers and logs. */
  message: string;

  /** Message that is safe to show to end users. */
  userMessage: string;

  /** Whether the same request may succeed if tried again. */
  retryable: boolean;

  /** Seconds the server asked us to wait before retrying, if any. */
  retryAfterSeconds?: number | null;

  /** Provider that caused the error, when the failure is provider-specific. */
  provider?: string;

  /** Extra context from the server (or the SDK) about the failure. */
  details?: Record<string, unknown>;

  /** The underlying error, e.g. the network failure behind a `ConnectionError`. */
  cause?: unknown;
}

/** Base class for every error the SDK throws after a request is made. */
export class PegarouteError extends Error {
  readonly code: ErrorCode;

  /** HTTP status, or `null` when no response was received. */
  readonly status: number | null;

  /** Safe to show to end users. */
  readonly userMessage: string;
  readonly retryable: boolean;
  readonly retryAfterSeconds: number | null;

  /** Provider that caused the error, when the failure is provider-specific. */
  readonly provider?: string;
  readonly details?: Record<string, unknown>;

  constructor(init: PegarouteErrorInit) {
    super(init.message, init.cause === undefined ? undefined : { cause: init.cause });

    this.name = new.target.name;
    this.code = init.code;
    this.status = init.status;
    this.userMessage = init.userMessage;
    this.retryable = init.retryable;
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;

    if (init.provider !== undefined) this.provider = init.provider;
    if (init.details !== undefined) this.details = init.details;
  }
}

export class BadRequestError extends PegarouteError {}
export class AuthenticationError extends PegarouteError {}
export class PermissionDeniedError extends PegarouteError {}
export class NotFoundError extends PegarouteError {}
export class ConflictError extends PegarouteError {}

/** The data needed to create a {@link ProviderChangedError}: the base fields plus the refreshed quote. */
export interface ProviderChangedErrorInit extends PegarouteErrorInit {
  /** The refreshed quote to review and retry with. */
  newQuote: QuoteResponse;

  /** The provider that was quoted (or requested with `routeProvider`). */
  originalProvider: string;

  /** The best provider under the refreshed quote. */
  newProvider: string;
}

/**
 * The quoted route is no longer available, so Pegaroute quoted again (HTTP 409, `PROVIDER_CHANGED`).
 * The original `quoteId` is used up: show the user `newQuote` and call `swaps.create` again with its `quoteId`.
 *
 * @example
 * catch (e) {
 *   if (e instanceof ProviderChangedError) retryWith(e.newQuote);
 * }
 */
export class ProviderChangedError extends ConflictError {
  /** The refreshed quote to review and retry with. */
  readonly newQuote: QuoteResponse;

  /** The provider that was quoted (or requested with `routeProvider`). */
  readonly originalProvider: string;

  /** The best provider under the refreshed quote. */
  readonly newProvider: string;

  constructor(init: ProviderChangedErrorInit) {
    super(init);

    this.newQuote = init.newQuote;
    this.originalProvider = init.originalProvider;
    this.newProvider = init.newProvider;
  }
}

/** The quote is no longer valid; request a new one. */
export class QuoteExpiredError extends PegarouteError {}
export class UnprocessableEntityError extends PegarouteError {}
export class RateLimitError extends PegarouteError {}

/** A chain is halted or disabled, or a provider is down. */
export class ServiceUnavailableError extends PegarouteError {}
export class InternalServerError extends PegarouteError {}

/**
 * No complete response was received: the connection failed (DNS, TCP, TLS, …) or dropped mid-response.
 * `status` is `null` unless the failure happened while reading the body.
 */
export class ConnectionError extends PegarouteError {}

/** The request did not complete within the configured timeout. */
export class TimeoutError extends ConnectionError {}

/** The data needed to create a {@link WaitTimeoutError}: the base fields plus the last swap seen. */
export interface WaitTimeoutErrorInit extends PegarouteErrorInit {
  /** The most recent successful poll, or `null` if the deadline passed before the first one returned. */
  lastSwap: GetSwapResponse | null;
}

/**
 * `swaps.waitForCompletion` reached its `timeoutMs` before the swap reached a terminal status (code `WAIT_TIMEOUT`).
 *
 * The swap itself didn't fail: it may still finish, so check it again later (or wait for its webhook).
 * Not a `TimeoutError`, which means a single HTTP request timed out.
 *
 * @example
 * catch (e) {
 *   if (e instanceof WaitTimeoutError) console.log("still", e.lastSwap?.status);
 * }
 */
export class WaitTimeoutError extends PegarouteError {
  /** The most recent successful poll, or `null` if the deadline passed before the first one returned. */
  readonly lastSwap: GetSwapResponse | null;

  constructor(init: WaitTimeoutErrorInit) {
    super(init);

    this.lastSwap = init.lastSwap;
  }
}

/**
 * Error classes that map to exactly one HTTP status.
 *
 * Not listed here on purpose:
 * - `InternalServerError` covers a range (500, 502, 504, other 5xx) — see {@link errorClassForStatus}.
 * - `ConnectionError` / `TimeoutError` can't be looked up by status because no response arrived; the HTTP client
 *   creates them directly. They still extend `PegarouteError` (with `status: null`).
 * - `ProviderChangedError` shares 409 with `ConflictError`; {@link errorFromResponse} picks it by the error code
 *   `PROVIDER_CHANGED` (and only when the body carries the refreshed quote).
 * - `WaitTimeoutError` isn't an HTTP failure at all: `swaps.waitForCompletion` throws it when its own deadline
 *   passes (also `status: null`).
 * - Any other status (e.g. 413) falls back to the base `PegarouteError`.
 */
const ERROR_CLASS_BY_STATUS: Record<number, typeof PegarouteError> = {
  400: BadRequestError,
  401: AuthenticationError,
  403: PermissionDeniedError,
  404: NotFoundError,
  409: ConflictError,
  410: QuoteExpiredError,
  422: UnprocessableEntityError,
  429: RateLimitError,
  503: ServiceUnavailableError,
};

/**
 * Statuses worth trying again when the error body doesn't say: rate limited, or a temporary gateway or availability
 * failure (often a proxy's own error page, without Pegaroute's error envelope).
 */
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

/** Exact status match first, then any other 5xx → `InternalServerError`, otherwise the base class. */
function errorClassForStatus(status: number): typeof PegarouteError {
  return ERROR_CLASS_BY_STATUS[status] ?? (status >= 500 ? InternalServerError : PegarouteError);
}

/**
 * The JSON body Pegaroute returns for every failed request ("envelope" = the wrapper object).
 * The error details are always nested under a top-level `error` key:
 *
 * @example
 * { "error": { "code": "QUOTE_EXPIRED", "message": "Quote has expired", "userMessage": "…", "retryable": false } }
 *
 * Only `code` and `message` are required here: the server always sends the rest today, but
 * parsing stays lenient so a missing field never hides the real error.
 */
interface PegarouteErrorEnvelope {
  error: {
    code: string;
    message: string;
    userMessage?: string;
    retryable?: boolean;
    retryAfterSeconds?: number | null;
    provider?: string;
    details?: Record<string, unknown>;
  };
}

/** Checks that a parsed body looks like an {@link PegarouteErrorEnvelope} (e.g. not a proxy's HTML error page). */
export function isPegarouteErrorEnvelope(value: unknown): value is PegarouteErrorEnvelope {
  if (typeof value !== "object" || value === null) return false;

  const error = (value as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return false;

  const { code, message } = error as { code?: unknown; message?: unknown };
  return typeof code === "string" && typeof message === "string";
}

/**
 * The extra top-level fields of a 409 `PROVIDER_CHANGED` body, next to the usual `error` envelope.
 *
 * @example
 * { "error": { "code": "PROVIDER_CHANGED", … }, "newQuote": { "quoteId": "…", … }, "originalProvider": "maya", "newProvider": "thorchain" }
 */
interface ProviderChangedBody {
  newQuote: QuoteResponse;
  originalProvider: string;
  newProvider: string;
}

/** Checks that a 409 body carries the refreshed quote and both provider names. */
function isProviderChangedBody(value: object): value is ProviderChangedBody {
  const { newQuote, originalProvider, newProvider } = value as Record<string, unknown>;

  return (
    typeof newQuote === "object" &&
    newQuote !== null &&
    typeof originalProvider === "string" &&
    typeof newProvider === "string"
  );
}

/**
 * Builds the matching error subclass from a non-2xx response and its (already read) body text.
 *
 * `retryable` is the server's own flag when its error body has one, otherwise it follows RETRYABLE_STATUSES. The HTTP client retries a GET only when it is `true`, so callers see the same answer the SDK acted on.
 */
export function errorFromResponse(response: Response, bodyText: string): PegarouteError {
  // Determine the appropriate error class based on the HTTP status code.
  const ErrorClass = errorClassForStatus(response.status);

  // Parse the response body as JSON, if possible.
  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    body = undefined;
  }

  // If the body isn't a valid Pegaroute error envelope, meaning, it doesn't have the expected `error` structure that Pegaroute always sends, return a generic error.
  if (!isPegarouteErrorEnvelope(body)) {
    return new ErrorClass({
      code: "UNKNOWN_ERROR",
      status: response.status,
      message: `HTTP ${response.status} ${response.statusText}`.trim(),
      userMessage: "Something went wrong. Please try again.",
      retryable: RETRYABLE_STATUSES.has(response.status),
      details: { body: bodyText.slice(0, 500) },
    });
  }

  // At this point, we know the body is a valid Pegaroute error envelope, so we can safely extract the `error` object.
  const { error } = body;
  const init: PegarouteErrorInit = {
    code: error.code,
    status: response.status,
    message: error.message,
    userMessage: error.userMessage ?? error.message,
    retryable: error.retryable ?? RETRYABLE_STATUSES.has(response.status),
    retryAfterSeconds: error.retryAfterSeconds ?? null,
    ...(error.provider !== undefined && { provider: error.provider }),
    ...(error.details !== undefined && { details: error.details }),
  };

  // A changed provider carries a refreshed quote to retry with. Without it, fall back to a plain `ConflictError`.
  if (response.status === 409 && error.code === "PROVIDER_CHANGED" && isProviderChangedBody(body)) {
    return new ProviderChangedError({
      ...init,
      newQuote: body.newQuote,
      originalProvider: body.originalProvider,
      newProvider: body.newProvider,
    });
  }

  return new ErrorClass(init);
}
