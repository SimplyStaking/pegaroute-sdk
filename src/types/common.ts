/** Providers Pegaroute is known to route through. Other names may appear as providers are added. */
export type KnownProvider = "thorchain" | "maya" | "openocean" | "instaswap" | "squid";

/** Any provider name, including ones added after this SDK version. */
export type Provider = KnownProvider | (string & {});

/**
 * Confidential execution mode for a swap.
 *
 * - `false` (or omitted): public execution.
 * - `true`: confidential execution, falling back to zkproof.
 * - `"zk"`: zkproof execution only.
 *
 * Other strings are reserved for provider modes added in the future.
 */
export type PrivateSwapMode = boolean | "zk" | (string & {});

/**
 * An exact on-chain amount, in two forms.
 *
 * @example
 * { display: "1000", baseUnits: "1000000000" } // 1000 USDC (6 decimals)
 */
export interface TokenAmount {
  /** Human-readable rendering of `baseUnits` for UI. Never rebuild `baseUnits` from it. */
  display: string;

  /** Exact integer in the token's smallest unit. Pass it unchanged to transfers, approvals and allowance checks. */
  baseUnits: string;
}

/**
 * Fees for a route, as human-readable decimal strings.
 *
 * Amounts are in destination-asset units (THORChain/Maya), or in USD when `unit` is `"USD"` (Instaswap/Squid).
 * Read `total` for the full fee the user pays.
 */
export interface QuoteFees {
  /** Pegaroute's affiliate fee. For Instaswap and Squid this excludes the integrator's share (see `subAffiliate`). */
  affiliate: string;

  /** Liquidity and other route fees. On Squid this includes Squid's own platform share. */
  liquidity: string;

  /** Outbound gas fee on the destination chain (`"0"` when not applicable). */
  outbound: string;

  /** Sum of `affiliate`, `liquidity`, `outbound` and `subAffiliate` (when present). */
  total: string;

  /** Present when all fee amounts are in USD instead of asset units. */
  unit?: "USD";

  /** The integrator's USD share, excluded from `affiliate` (Instaswap/Squid only). */
  subAffiliate?: string;

  /** Total provider-facing fee in basis points, when the provider reports it. */
  totalBps?: number;

  /** Slippage in basis points, when the provider reports it. */
  slippageBps?: number;
}

/** How the affiliate fee on a swap was split between Pegaroute and the integrator, in basis points. */
export interface AffiliateFeeBreakdown {
  /** Pegaroute's configured share, before the provider cap is applied. */
  configuredPegasusShareBps: number;

  /** The integrator's configured share, before the provider cap is applied. */
  configuredIntegratorFeeBps: number;

  /** The provider's maximum affiliate/referrer fee. */
  providerAffiliateCapBps: number;

  /** The affiliate fee actually sent to the provider, after the cap. */
  effectiveAffiliateFeeBps: number;

  /** Pegaroute's share after the cap. */
  realizedPegasusFeeBps: number;

  /** The integrator's share after the cap. */
  realizedIntegratorFeeBps: number;

  /** Which provider fee config was used for this route. */
  feeSource: string;

  /** Pegaroute's real net revenue, after any provider revenue share. */
  pegasusNetBps?: number;

  /** Pegaroute's net revenue in USD, when the provider reports it (Instaswap). */
  pegasusNetUsd?: string;
}

/** The OpenOcean meta-aggregator (Jupiter, Titan, Cetus, …) behind a Solana or Sui route. */
export interface OpenOceanRouteMeta {
  /** Index of the winning aggregator, e.g. Solana `10` = Titan, `6` = Jupiter. */
  dexId?: number;

  /** Name of the winning aggregator, e.g. `"Titan"`. */
  dexCode?: string;

  /** Every aggregator OpenOcean considered for the quote. */
  dexes?: Array<{
    dexId?: number;
    dexCode?: string;
  }>;
}

/** The route a swap was executed on. Returned by `swaps.create`, `swaps.get` and `transactions.list`. */
export interface RouteInfo {
  /** The provider executing the swap. */
  provider: Provider;

  /** Route chosen inside the provider (e.g. `"Chainflip"`), when the provider exposes one. */
  subprovider?: string;

  /** Confidential execution mode of the swap. */
  private?: PrivateSwapMode;

  /** Expected output amount in the destination token, as a human-readable decimal. */
  expectedOutput: string;

  /** Fees for this route. */
  fees: QuoteFees;

  /** Estimated time to complete, in seconds. */
  estimatedTimeSeconds: number;

  /** OpenOcean aggregator behind the route (Solana/Sui only). */
  openOceanRoute?: OpenOceanRouteMeta;
}

/**
 * A refund observed for a failed swap.
 *
 * `status` here is the refund's own lifecycle, separate from the swap's status: a swap can already be
 * `refunded` (internal) / `fail` (external) while the refund is still `pending` or `broadcasting`.
 */
export interface RefundInfo {
  /** Refund lifecycle state. */
  status: "pending" | "broadcasting" | "completed";

  /** Refund transaction hash, once known. */
  txHash?: string;

  /** Chain the refund is sent on. */
  chain: string;

  /** Amount refunded, as a human-readable decimal. */
  amount: string;

  /** The original source amount of the swap. */
  originalAmount: string;

  /** Amount deducted from the refund (e.g. network fees). */
  feeDeducted: string;

  /** What the deducted amount was for. */
  feeDescription: string;

  /** Address the refund was actually sent to. May differ from the refund address requested on the swap. */
  refundAddress: string;

  /** When the refund completed (ISO 8601), once known. */
  completedAt?: string;
}

/** Progress of a streaming swap, which executes as several smaller sub-swaps. */
export interface StreamingProgress {
  /** Sub-swaps finished so far. */
  completedSubSwaps: number;

  /** Total sub-swaps planned. */
  totalSubSwaps: number;

  /** When the last sub-swap happened (ISO 8601). */
  lastSubSwapTimestamp?: string;

  /** Output received so far, as a human-readable decimal. */
  partialOutput?: string;

  /** Amount refunded so far, when some sub-swaps could not execute. */
  partialRefund?: {
    amount: string;
    chain: string;
    token: string;
  };
}
