export { Pegaroute, type PegarouteOptions } from "./client.js";
export {
  AuthenticationError,
  BadRequestError,
  ConflictError,
  ConnectionError,
  InternalServerError,
  NotFoundError,
  PegarouteError,
  PermissionDeniedError,
  ProviderChangedError,
  QuoteExpiredError,
  RateLimitError,
  ServiceUnavailableError,
  TimeoutError,
  UnprocessableEntityError,
  WaitTimeoutError,
} from "./core/errors.js";
export type { Fetch, RequestOptions } from "./core/http.js";
export type { PagePromise } from "./core/pagination.js";
export type { WaitForCompletionOptions } from "./resources/swaps.js";

// Also expose every domain type and guard here, so backend code needs a single import path.
// `@pegaroute/sdk/types` remains the browser-safe subset of these same exports.
export * from "./types/index.js";
export {
  type VerifyWebhookParams,
  verifyWebhook,
  WebhookVerificationError,
  type WebhookVerificationFailure,
} from "./webhooks.js";
