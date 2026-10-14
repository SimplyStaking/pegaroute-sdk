// Browser-safe entry: types and type guards only. Never import the client here.

export {
  type AdditionalFee,
  type AffiliateFeeBreakdown,
  type FeeAmount,
  hasQuoteRouteFees,
  type KnownProvider,
  type NoQuoteRouteFees,
  type OpenOceanRouteMeta,
  type PrivateSwapMode,
  type Provider,
  type QuoteRouteFees,
  type RefundInfo,
  type RouteInfo,
  type StreamingProgress,
  type TokenAmount,
} from "./common.js";
export type {
  Chain,
  ChainsResponse,
  HealthResponse,
  KnownProviderType,
  ListProvidersParams,
  PingResponse,
  ProviderAffiliateFeeStructure,
  ProviderFeeStructure,
  ProviderHealth,
  ProviderInfo,
  ProvidersResponse,
  ProviderTakeStructure,
  ProviderType,
  Token,
  TokensResponse,
} from "./discovery.js";
export type { ErrorCode, KnownErrorCode } from "./errors.js";
export {
  type CosmosBankSendSwapExecution,
  type CosmosMsgDepositSwapExecution,
  type CosmosMsgExecuteSwapExecution,
  type EvmApproval,
  type EvmSwapExecution,
  type ExecutionFamily,
  type ExecutionMode,
  type ExecutionOfFamily,
  type ExecutionOfMode,
  isExecutionFamily,
  isExecutionMode,
  type JsonSwapExecution,
  type NamedDepositSwapExecution,
  type OtherDepositSwapExecution,
  type SerializedSwapExecution,
  type SwapExecution,
  type UtxoSwapExecution,
} from "./execution.js";
export type {
  GetQuoteParams,
  QuoteResponse,
  QuoteRoute,
  RouteWarning,
} from "./quotes.js";
export { type InternalSwapStatus, isTerminalStatus, type SwapStatus, toExternalStatus } from "./status.js";
export type {
  CreateSwapParams,
  CreateSwapResponse,
  GetSwapResponse,
  InstaswapFeeLine,
  InstaswapSwapLiteSnapshot,
  ProviderStatusInfo,
  SubmitTxHashParams,
  SubmitTxHashResponse,
  SwapEvent,
  SwapEventsResponse,
  SwapFailure,
  SwapInput,
  SwapOutput,
  SwapProviderInfo,
  SwapTimestamps,
} from "./swaps.js";
export type {
  CursorPagination,
  ExpectedAffiliateEntry,
  ListTransactionsParams,
  Transaction,
  TransactionsResponse,
} from "./transactions.js";
export type {
  TestWebhookEvent,
  TransactionWebhookData,
  TransactionWebhookEvent,
  TransactionWebhookEventType,
  WebhookEvent,
  WebhookStreamingProgress,
} from "./webhooks.js";
