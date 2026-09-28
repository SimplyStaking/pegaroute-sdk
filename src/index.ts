export { Pegaroute, type PegarouteOptions } from "./client.js";
export {
  AuthenticationError,
  BadRequestError,
  ConflictError,
  ConnectionError,
  type ErrorCode,
  InternalServerError,
  type KnownErrorCode,
  NotFoundError,
  PegarouteError,
  PermissionDeniedError,
  QuoteExpiredError,
  RateLimitError,
  ServiceUnavailableError,
  TimeoutError,
  UnprocessableEntityError,
} from "./core/errors.js";
export type { Fetch, RequestOptions } from "./core/http.js";

// Also expose every domain type and guard here, so backend code needs a single import path.
// `@pegaroute/sdk/types` remains the browser-safe subset of these same exports.
export * from "./types/index.js";
