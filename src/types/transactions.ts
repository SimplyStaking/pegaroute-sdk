import type { AffiliateFeeBreakdown, Provider, QuoteFees, RefundInfo, RouteInfo } from "./common.js";
import type { InternalSwapStatus, SwapStatus } from "./status.js";
import type { SwapFailure, SwapInput, SwapOutput, SwapTimestamps } from "./swaps.js";

/**
 * Filters for `transactions.list()`. All are optional.
 *
 * @example
 * { status: "failed", provider: "thorchain", startTime: "2026-09-01T00:00:00Z", count: 100 }
 */
export interface ListTransactionsParams {
  /** Only swaps in this **internal** status, e.g. `"failed"` (not the external `"fail"`). */
  status?: InternalSwapStatus;

  /** Only swaps executed by this provider; case is ignored. */
  provider?: Provider;

  /** Only swaps created at or after this time (ISO 8601). */
  startTime?: string;

  /** Only swaps created at or before this time (ISO 8601). */
  endTime?: string;

  /** Page size, from 1 to 200. Default 50. */
  count?: number;

  /** Start after this cursor (a previous page's `pagination.nextCursor`). Not needed when iterating with `for await`. */
  cursor?: string;
}

/**
 * A swap as listed by `transactions.list()`: the same data as `swaps.get()` under different field names,
 * plus Pegaroute's affiliate-fee verification data.
 */
export interface Transaction {
  /** Swap ID (`transactionId` elsewhere). */
  id: string;

  /** The integration the swap belongs to (the one your API key is scoped to). */
  integrationId: string;

  /** External status. Use this one for business logic. */
  status: SwapStatus;

  /** Internal status, for debugging. */
  internalStatus: InternalSwapStatus;

  /** The source side of the swap (`input` in `swaps.get()`). */
  source: SwapInput;

  /** The destination side of the swap (`output` in `swaps.get()`). */
  destination: SwapOutput;

  /** The route the swap executes on. */
  route: RouteInfo;

  /** Fees for the swap. */
  fees: QuoteFees;

  /** How the affiliate fee was split, when recorded. */
  affiliateFeeBreakdown?: AffiliateFeeBreakdown;

  /** Why the swap failed, if it did. */
  error?: SwapFailure;

  /** The refund for a failed swap, if there is one. */
  refund?: RefundInfo;

  /** When the swap reached each stage. */
  timestamps: SwapTimestamps;

  // Pegaroute's affiliate-fee verification data. Not in the API spec and may be removed by Pegaroute.

  /** The exact THORChain/Maya memo built for the swap, when the route uses one. */
  expectedMemo?: string;

  /** Affiliates parsed from `expectedMemo`; empty when there is none. */
  expectedAffiliateEntries: ExpectedAffiliateEntry[];

  /** Referrer address the provider is expected to credit (e.g. OpenOcean), when set. */
  expectedReferrerAddress?: string;

  /** ID of the affiliate configuration used for the swap (THORChain/Maya only). */
  selectedProviderAffiliateCompositionId?: string;

  /** When the on-chain memo was last checked against `expectedMemo` (ISO 8601). */
  memoVerifiedAt?: string;
}

/** One affiliate in a swap's memo, as Pegaroute expects the provider to pay it. */
export interface ExpectedAffiliateEntry {
  /** Position in the memo's affiliate list, starting at 0. */
  position: number;

  /** Affiliate name as written in the memo. */
  name: string;

  /** Fee in basis points, or `null` when unknown. */
  bps: number | null;

  /** Whether `bps` was written in the memo (`"explicit"`) or is the affiliate name's default (`"name_default"`). */
  bpsSource: "explicit" | "name_default";

  /** Pegaroute's ID for the affiliate, when it is one of the configured ones. */
  affiliateId?: string;

  /** Whose affiliate it is: Pegaroute's (`"operator"`) or the integrator's (`"client"`). */
  scope?: "operator" | "client";
}

/** Where a page sits in a cursor-paginated list. */
export interface CursorPagination {
  /** Pass as `cursor` to get the next page; `null` on the last page. */
  nextCursor: string | null;

  /** Whether more pages follow. */
  hasMore: boolean;
}

/** One page of `transactions.list()`, newest swaps first. */
export interface TransactionsResponse {
  transactions: Transaction[];

  pagination: CursorPagination;
}
