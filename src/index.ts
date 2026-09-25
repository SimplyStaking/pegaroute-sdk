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
