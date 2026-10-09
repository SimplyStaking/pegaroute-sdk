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
