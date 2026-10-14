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
 * A fee, in two forms: USD, and basis points of the swap's input USD value (100 bps = 1%).
 *
 * @example
 * { usd: "2.5", bps: 10 } // $2.50 on a $2,500 swap
 */
export interface FeeAmount {
  /** Amount in USD, as a decimal string, e.g. `"2.7178"`. */
  usd: string;

  /** The same amount in basis points of the input USD value. */
  bps: number;
}

/**
 * What a route costs the user, in USD and in basis points of the input USD value.
 *
 * Pegaroute prices the input and output tokens once per quote request, so all routes of a quote use the same
 * reference prices and compare directly. Source-chain gas that the wallet pays and the route's `additionalFee` are not
 * included.
 *
 * Never negative. If `expectedOutput` is worth more than the input (the user gains on the swap), `totalUsd`, `totalBps`
 * and every part of `breakdown` are `0` instead of negative. A `0` fee therefore doesn't say how much the user gains:
 * if two routes both show `0`, one can still pay out more. Compare them by `expectedOutput`, not by fee.
 */
export interface QuoteRouteFees {
  /** `totalUsd` in basis points of the input USD value. Never negative. */
  totalBps: number;

  /** Cost of the swap in USD: input USD − `expectedOutput` USD. Never negative. */
  totalUsd: string;

  /** The total split in three parts: `affiliate` + `route` + `gas` = total, in USD and in bps. */
  breakdown: {
    /** The fee that Pegaroute and the integrator receive. */
    affiliate: FeeAmount;

    /**
     * All other costs: provider fees, price impact, spread, and the difference between the provider's price and the
     * reference price.
     *
     * Can be negative. That happens when the provider offers a better rate than the reference price: the extra the
     * user gets cancels out part of the affiliate and gas fees, so the total ends up below `affiliate` + `gas`. The
     * three parts still add up to the total.
     *
     * @example
     * // $1,000 in, $999.50 out: total $0.50, affiliate $1, gas $0 → route $0.50 − $1 − $0.
     * // The provider's rate is $0.50 better than the reference price.
     * { usd: "-0.5", bps: -5 }
     */
    route: FeeAmount;

    /**
     * Gas the provider takes from the output (`expectedOutput` is already after it). On Instaswap private routes it
     * also includes the zkproof protocol fee.
     */
    gas: FeeAmount;
  };
}

/**
 * A route's `fees` when Pegaroute has no fee data for it, sent as `{}`: there is no reference price for the input or
 * output token, or the provider's quote doesn't show the fee it applies. This is not a zero fee: don't show it as one.
 */
export type NoQuoteRouteFees = { [K in keyof QuoteRouteFees]?: never };

/**
 * Whether Pegaroute sent fee data for a route. `false` means `{}`: no fee data, not a zero fee.
 *
 * @example
 * if (hasQuoteRouteFees(route.fees)) {
 *   show(`$${route.fees.totalUsd} (${route.fees.totalBps} bps)`);
 * }
 */
export function hasQuoteRouteFees(fees: QuoteRouteFees | NoQuoteRouteFees): fees is QuoteRouteFees {
  return fees.totalUsd !== undefined;
}

/**
 * A fee the wallet pays in the source chain's native coin, on top of the quoted amount and the source network gas.
 *
 * @example
 * { token: "ETH", amount: "0.0004" } // a 0.1 ETH swap needs to send 0.1004 ETH
 */
export interface AdditionalFee {
  /** Token ID of the source chain's native coin, as in `tokens.list(fromChain)`, e.g. `"ETH"`. */
  token: string;

  /** Fee amount, as a human-readable decimal, e.g. `"0.0004"`. */
  amount: string;
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
    /** Index of the aggregator. */
    dexId?: number;

    /** Name of the aggregator. */
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
    /** Amount refunded, in the same format as `partialOutput`. */
    amount: string;

    /** Chain the refund was sent on. */
    chain: string;

    /** Token refunded. */
    token: string;
  };
}
