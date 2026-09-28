import type { ErrorCode } from "../core/errors.js";
import type { OpenOceanRouteMeta, PrivateSwapMode, Provider, QuoteFees } from "./common.js";
import type { ProviderType } from "./discovery.js";

/**
 * What to quote. Chain and token IDs come from `chains.list()` and `tokens.list(chain)`; case is ignored.
 *
 * @example
 * { fromChain: "ETH", fromToken: "ETH", toChain: "BTC", toToken: "BTC", amount: "0.5" }
 */
export interface GetQuoteParams {
  /** Source chain ID, e.g. `"ETH"`. */
  fromChain: string;

  /** Source token ID, e.g. `"ETH"` or `"USDC-0xA0b8…"`. */
  fromToken: string;

  /** Destination chain ID, e.g. `"BTC"`. */
  toChain: string;

  /** Destination token ID, e.g. `"BTC"`. */
  toToken: string;

  /** Amount of the source token, as a human-readable decimal, e.g. `"0.5"`. */
  amount: string;

  /** Confidential execution mode. Routes from providers that don't support it are left out. */
  private?: PrivateSwapMode;

  /** Real recipient address, for providers that need one to quote. A placeholder is used when omitted. */
  destinationAddress?: string;

  /** Address sending the funds. Required when `refundAddress` is set; the quote is bound to it. */
  senderAddress?: string;

  /**
   * Where refunds should go, if not the sender. Providers that can't refund to a different address
   * are left out of `routes` and listed in `warnings`.
   */
  refundAddress?: string;
}

/**
 * One way to execute the swap, from one provider.
 *
 * `memo`, `inboundAddress`, `router` and `gasRate` are a preview only. `swaps.create` rebuilds them (the memo gets
 * the real destination address, the vault address is refreshed), so sign with the `execution` it returns,
 * e.g. `execution.memo`, never with these fields.
 */
export interface QuoteRoute {
  /** Provider offering this route. Pass it as `routeProvider` to `swaps.create` to choose this route. */
  provider: Provider;

  /** Route chosen inside the provider (e.g. `"Chainflip"`), when the provider exposes one. */
  subprovider?: string;

  /** Confidential execution mode of this route. */
  private?: PrivateSwapMode;

  /** The provider's integration type. */
  providerType: ProviderType;

  /** Expected output in the destination token, as a human-readable decimal, after fees. */
  expectedOutput: string;

  /** Estimated time to complete, in seconds. */
  estimatedTimeSeconds: number;

  /** Fees for this route. */
  fees: QuoteFees;

  /** The provider's own quote expiry (ISO 8601 or Unix seconds), if it has one. Use the quote's `expiresAt` instead. */
  expiry: string | null;

  /** Transaction memo (THORChain/Maya), if any. */
  memo: string | null;

  /** Vault address funds are sent to, if any. */
  inboundAddress: string | null;

  /** Router contract address (EVM), when the provider exposes one. */
  router: string | null;

  /** Recommended fee rate for UTXO transactions, if any. */
  gasRate: string | null;

  /** Minimum swap amount in the source token, as a human-readable decimal, if the provider has one. */
  minAmount: string | null;

  /** The fee applied to this route after provider caps. */
  resolvedFee: {
    /** Effective fee in basis points. */
    feeBps: number;
  };

  /** OpenOcean aggregator behind the route (Solana/Sui only). */
  openOceanRoute?: OpenOceanRouteMeta;
}

/** Why a provider didn't return a route. */
export interface RouteWarning {
  /** The provider that failed. Rarely empty, e.g. when no provider is enabled. */
  provider: string;

  /** Same codes as API errors, e.g. `PROVIDER_TIMEOUT` or `UNSUPPORTED_PAIR`. */
  code: ErrorCode;

  /** Technical message for logs. */
  message: string;

  /** Message that is safe to show to end users. */
  userMessage: string;
}

/**
 * Response of `quotes.get()`.
 *
 * A 200 response can have no routes: check `warnings` to see why each provider was left out.
 */
export interface QuoteResponse {
  /** Pass to `swaps.create` to execute on these terms. */
  quoteId: string;

  /** When the quote expires (ISO 8601). After that, `swaps.create` throws `QuoteExpiredError`. */
  expiresAt: string;

  /** Available routes, best first: highest output, then fastest, then lowest slippage. */
  routes: QuoteRoute[];

  /** One entry per provider that was tried but didn't return a route. */
  warnings: RouteWarning[];
}
