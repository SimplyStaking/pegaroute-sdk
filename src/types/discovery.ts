/** A chain Pegaroute can route to or from. */
export interface Chain {
  /** Chain ID to use in quote and swap requests, e.g. `"ETH"`. */
  id: string;

  /** Display name, e.g. `"Ethereum"`. */
  name: string;

  /** EVM chain ID, or `null` for non-EVM chains. */
  chainId: number | null;
}

/** Response of `chains.list()`. */
export interface ChainsResponse {
  chains: Chain[];
}

/** A token Pegaroute recognises on a chain. Decimals are not included: use the swap's `TokenAmount` values instead. */
export interface Token {
  /** Token ID to use in quote and swap requests, e.g. `"SOL"` or `"USDC-0xA0b8…"`. */
  id: string;

  /** Display symbol, e.g. `"USDC"`. */
  symbol: string;
}

/** Response of `tokens.list(chain)`. */
export interface TokensResponse {
  /** Canonical ID of the requested chain (the lookup ignores case). */
  chain: string;

  tokens: Token[];
}

/** Provider integration types Pegaroute is known to use. */
export type KnownProviderType = "cross-chain-amm" | "cross-chain-aggregator" | "dex-aggregator" | "api-provider";

/** Any provider integration type, including ones added after this SDK version. */
export type ProviderType = KnownProviderType | (string & {});

/**
 * A provider's documented affiliate (referrer) fee range.
 * Each value is given both in basis points and as a percent.
 */
export interface ProviderAffiliateFeeStructure {
  /** Minimum fee in basis points, when the provider documents one. */
  minBps?: number;

  /** Minimum fee as a percent, when the provider documents one. */
  minPercent?: number;

  /** Minimum non-zero fee in basis points; zero (no fee) stays valid. */
  minBpsWhenSet?: number;

  /** Minimum non-zero fee as a percent; zero (no fee) stays valid. */
  minPercentWhenSet?: number;

  /** Maximum fee in basis points. */
  maxBps: number;

  /** Maximum fee as a percent. */
  maxPercent: number;

  /** Fee the provider applies when none is requested, in basis points. */
  defaultBps?: number;

  /** Fee the provider applies when none is requested, as a percent. */
  defaultPercent?: number;
}

/** The provider's cut of the affiliate fee (a share of the fee, not of the swap amount). */
export interface ProviderTakeStructure {
  /** Provider's cut in basis points of the affiliate fee. */
  bpsOfAffiliateFee: number;

  /** Provider's cut as a percent of the affiliate fee. */
  percentOfAffiliateFee: number;
}

/** A provider's documented affiliate fee range and its cut of that fee. */
export interface ProviderFeeStructure {
  affiliateFee: ProviderAffiliateFeeStructure;

  /** Provider's cut of the affiliate fee, or `null` when it takes none. */
  providerTake: ProviderTakeStructure | null;
}

/** A provider's live status, as returned by `health()`. */
export interface ProviderHealth {
  /** Provider name, e.g. `"thorchain"`. */
  name: string;

  /** Provider integration type. */
  type: ProviderType;

  /** Whether the provider's last health check succeeded. */
  available: boolean;

  /** Whether the provider is switched on for new quotes. */
  routingEnabled: boolean;

  /** Pegaroute's circuit breaker for this provider: `open` means requests to it are currently paused. */
  circuitState: "closed" | "open" | "half-open";

  /** Latency of the last health check, in milliseconds. */
  latencyMs: number;

  /** Chains the provider has halted. */
  haltedChains: string[];

  /** When the provider was last checked (ISO 8601). */
  lastChecked: string;

  /** Pegaroute's maximum affiliate fee for this provider in basis points, or `null` when none is configured. */
  maxAffiliateBps: number | null;

  /** The provider's documented fee range, or `null` when unknown. */
  feeStructure: ProviderFeeStructure | null;
}

/** A provider, as returned by `providers.list()`. */
export interface ProviderInfo extends ProviderHealth {
  /**
   * Chain IDs the provider can route in principle. A quote is still the source of truth for current availability.
   */
  supportedChains: string[];

  /** Only returned to Pegaroute operators; always `null` for API keys. */
  configuredReferral: null;
}

/** Options for `providers.list()`. */
export interface ListProvidersParams {
  /** Also return providers that are switched off (`routingEnabled: false`). Default `false`. */
  includeDisabled?: boolean;
}

/** Response of `providers.list()`. */
export interface ProvidersResponse {
  providers: ProviderInfo[];
}

/** Response of `health()`. */
export interface HealthResponse {
  /** `degraded` when the database is down or an enabled provider is unavailable. */
  status: "ok" | "degraded";

  /** Server time (ISO 8601). */
  timestamp: string;

  /** Database connectivity. Reports `connected: false` when Pegaroute runs without a database. */
  db: {
    connected: boolean;
    latencyMs: number;
  };

  /** Write-ahead log backlog. `pendingEntries` is `-1` when it can't be read. */
  wal: {
    pendingEntries: number;
  };

  /** Status of every provider, including disabled ones. */
  providers: ProviderHealth[];
}

/** Response of `ping()`. */
export interface PingResponse {
  /** Always `"pong"`. */
  response: "pong";

  /** Server time (ISO 8601). */
  timestamp: string;

  /** Service name, `"pegaroute"`. */
  service: string;
}
