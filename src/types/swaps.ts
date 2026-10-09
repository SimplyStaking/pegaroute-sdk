import type {
  AffiliateFeeBreakdown,
  PrivateSwapMode,
  Provider,
  QuoteFees,
  RefundInfo,
  RouteInfo,
  StreamingProgress,
} from "./common.js";
import type { ProviderType } from "./discovery.js";
import type { ErrorCode } from "./errors.js";
import type { SwapExecution } from "./execution.js";
import type { InternalSwapStatus, SwapStatus } from "./status.js";

/**
 * What to swap. Pass the `quoteId` and chosen route's `provider` from `quotes.get()` to execute on the quoted terms.
 * Without a `quoteId`, Pegaroute quotes again and picks the best route itself.
 *
 * @example
 * {
 *   fromChain: "ETH", fromToken: "ETH", toChain: "BTC", toToken: "BTC", amount: "0.5",
 *   senderAddress: "0xabc…", destinationAddress: "bc1q…",
 *   quoteId: quote.quoteId, routeProvider: quote.routes[0].provider,
 * }
 */
export interface CreateSwapParams {
  /** Source chain ID, e.g. `"ETH"`. Must match the quote. */
  fromChain: string;

  /** Source token ID, e.g. `"ETH"`. Must match the quote. */
  fromToken: string;

  /** Destination chain ID, e.g. `"BTC"`. Must match the quote. */
  toChain: string;

  /** Destination token ID, e.g. `"BTC"`. Must match the quote. */
  toToken: string;

  /** Amount of the source token, as a human-readable decimal, e.g. `"0.5"`. Must match the quote. */
  amount: string;

  /** Address that receives the swapped funds. */
  destinationAddress: string;

  /** Address sending the funds. Must match the quote's `senderAddress`, if it had one. */
  senderAddress: string;

  /** Where refunds should go, if not the sender. Must match the quote's `refundAddress`, if it had one. */
  refundAddress?: string;

  /** Maximum slippage as a fraction between 0 and 1, e.g. `0.01` for 1%. Uses the provider's default when omitted. */
  slippageTolerance?: number;

  /** Execute as a streaming swap (several smaller sub-swaps), where the provider supports it. */
  streaming?: boolean;

  /** The `quoteId` from `quotes.get()`. Throws `QuoteExpiredError` if it expired and no route is still valid. */
  quoteId?: string;

  /** The chosen route's `provider` from the quote. Without it, the best route is used. */
  routeProvider?: Provider;

  /** Confidential execution mode. Must match the quote. */
  private?: PrivateSwapMode;
}

/** The provider executing a swap, with its own reference for the swap. */
export interface SwapProviderInfo {
  /** Provider name, e.g. `"thorchain"`. */
  name: Provider;

  /** The provider's own ID for the swap (e.g. an Instaswap txid or Squid quote ID), if it has one. */
  referenceId: string | null;

  /** Extra provider metadata for UI and debugging (e.g. OpenOcean route, warnings). Never needed to sign. */
  details: Record<string, unknown> | null;
}

/**
 * Response of `swaps.create()`.
 *
 * Send `execution` to the frontend for signing, then report the tx hash with `swaps.submitTxHash()`.
 */
export interface CreateSwapResponse {
  /** Swap ID. Use it with `swaps.get`, `swaps.events` and `swaps.submitTxHash`. */
  transactionId: string;

  /** External status of the new swap. `"pending"` today. */
  status: SwapStatus;

  /** The integration type of the selected provider. */
  providerType: ProviderType;

  /** The route the swap will execute on. */
  route: RouteInfo;

  /** What the user must sign. Switch on `family` and `mode`, never on the provider name. */
  execution: SwapExecution;

  /** The provider executing the swap. */
  provider: SwapProviderInfo;
}

/** The provider's own status for a swap, when it reports one. */
export interface ProviderStatusInfo {
  /** The provider's native status value. */
  status: string;

  /** Whether the user must act (e.g. top up a deposit) before the swap can continue. */
  actionRequired: boolean;

  /** Short explanation of the status. */
  message: string;

  /** Provider or chain explorer link, when available. */
  explorerUrl?: string;
}

/** One fee line in an Instaswap deposit quote. */
export interface InstaswapFeeLine {
  type?: string;

  name?: string;

  amountUsd?: number;

  asset?: string;

  amount?: number;
}

/** Instaswap's deposit details for a swap, kept so a deposit UI can be shown again after a reload. */
export interface InstaswapSwapLiteSnapshot {
  /** Instaswap's swap ID. */
  txid: string;

  /** Estimated output amount. */
  estimatedOut?: number;

  /** Estimated output value in USD. */
  estimatedOutUsd?: number;

  /** Amount to deposit. For display only: sign with the amounts in `execution`. */
  depositAmount?: number;

  /** Exact amount to deposit, as a human-readable decimal. For display only: sign with the amounts in `execution`. */
  depositAmountExact?: string;

  /** Deposit value in USD. */
  depositAmountUsd?: number;

  /** Fee lines. */
  feeBreakdown?: InstaswapFeeLine[];

  /** Estimated time to complete, in seconds. */
  etaSeconds?: number;

  /** Address to deposit to. */
  depositAddress: string;

  /** Symbol of the token to deposit, e.g. `"BTC"`. */
  depositTokenSymbol?: string;

  /** When the deposit window closes (ISO 8601), if it does. */
  expiresAt?: string | null;

  /** Deposit instructions to show the user. */
  instructions?: string;
}

/** The source side of a swap. */
export interface SwapInput {
  /** Source chain ID. */
  chain: string;

  /** Source token ID. */
  token: string;

  /** Amount sent, as a human-readable decimal. */
  amount: string;

  /** Address sending the funds. */
  address?: string;

  /** Where refunds go. Falls back to `address` for older swaps. */
  refundAddress?: string;

  /** Source transaction hash, once reported with `swaps.submitTxHash()` or detected. */
  txHash?: string;

  /** The provider's own ID for the swap, if it has one. */
  providerReferenceId?: string;

  /** The provider's latest status for the swap, when it reports one. */
  providerStatus?: ProviderStatusInfo;

  /** Instaswap deposit details (Instaswap swaps only). */
  instaswapSwapLite?: InstaswapSwapLiteSnapshot;
}

/** The destination side of a swap. */
export interface SwapOutput {
  /** Destination chain ID. */
  chain: string;

  /** Destination token ID. */
  token: string;

  /** Address receiving the funds. */
  address: string;

  /** Amount received, as a human-readable decimal, once known. */
  amount?: string;

  /** Destination transaction hash, once known. */
  txHash?: string;
}

/** When a swap reached each stage (ISO 8601). Stages can be skipped. */
export interface SwapTimestamps {
  /** When the swap was created. */
  created: string;

  /** When the source tx hash was reported. */
  submitted?: string;

  /** When the source transaction was confirmed. */
  confirmed?: string;

  /** When the swap finished, whatever the outcome. */
  completed?: string;
}

/** Why a swap failed. */
export interface SwapFailure {
  /** Same codes as API errors, e.g. `SLIPPAGE_EXCEEDED`. */
  code: ErrorCode;

  /** Technical message for logs. */
  message: string;

  /** Message that is safe to show to end users. */
  userMessage: string;

  /** Provider that caused the failure, when it is provider-specific. */
  provider?: string;
}

/** Response of `swaps.get()`: the swap's current state. */
export interface GetSwapResponse {
  /** Swap ID. */
  transactionId: string;

  /** External status. Use this one for business logic. */
  status: SwapStatus;

  /** Internal status, for debugging. */
  internalStatus: InternalSwapStatus;

  /** The route the swap executes on. */
  route: RouteInfo;

  /** The source side of the swap. */
  input: SwapInput;

  /** The destination side of the swap. */
  output: SwapOutput;

  /** Fees for the swap. */
  fees: QuoteFees;

  /** How the affiliate fee was split, when recorded. */
  affiliateFeeBreakdown?: AffiliateFeeBreakdown;

  /** When the swap reached each stage. */
  timestamps: SwapTimestamps;

  /** Why the swap failed, or `null`. */
  error: SwapFailure | null;

  /** The refund for a failed swap, or `null`. */
  refund: RefundInfo | null;

  /** Progress of a streaming swap, or `null` for a regular swap. */
  streamingProgress: StreamingProgress | null;

  /** What the user must sign, when it can be rebuilt (e.g. an Instaswap deposit). Same shape as `swaps.create()`. */
  execution?: SwapExecution;

  /** The provider executing the swap. Present together with `execution`. */
  provider?: SwapProviderInfo;
}

/** One entry in a swap's audit log. */
export interface SwapEvent {
  /** Event ID. */
  id: string;

  /** Internal status before the event; `"none"` for the swap's creation. */
  fromStatus: InternalSwapStatus | "none";

  /** Internal status after the event. Equal to `fromStatus` for audit entries that don't change status. */
  toStatus: InternalSwapStatus;

  /** When the event happened (ISO 8601). */
  timestamp: string;

  /** Extra context recorded with the event, e.g. `{ txHash }`, or `null`. */
  metadata: Record<string, unknown> | null;
}

/** Response of `swaps.events()`. */
export interface SwapEventsResponse {
  /** Swap ID. */
  transactionId: string;

  /** Events, oldest first. */
  events: SwapEvent[];
}

/** The source transaction to report for a swap. */
export interface SubmitTxHashParams {
  /** Hash of the signed and broadcast source transaction. */
  txHash: string;

  /**
   * The EIP-191 `personal_sign` signature (`0x` + 130 hex chars), required when the swap's
   * `execution.signature` asked for one. Leave it out otherwise.
   */
  signature?: string;
}

/** Response of `swaps.submitTxHash()`. */
export interface SubmitTxHashResponse {
  /** Swap ID. */
  transactionId: string;

  /** Internal status after reporting the hash. `"submitted"` today (external `"executing"`). */
  status: InternalSwapStatus;

  /** The reported hash. */
  txHash: string;
}
