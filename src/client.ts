import { type Fetch, HttpClient, type RequestOptions } from "./core/http.js";
import { assertIntegerAtLeast } from "./core/validation.js";
import { Chains } from "./resources/chains.js";
import { Providers } from "./resources/providers.js";
import { Quotes } from "./resources/quotes.js";
import { Swaps } from "./resources/swaps.js";
import { Tokens } from "./resources/tokens.js";
import { Transactions } from "./resources/transactions.js";
import type { HealthResponse, PingResponse } from "./types/discovery.js";

/** Settings for a {@link Pegaroute} client. */
export interface PegarouteOptions {
  /** Integration API key. Keep it server-side. */
  apiKey: string;

  /** Pegaroute API base URL, e.g. `https://api.pegaroute.com`. */
  baseUrl: string;

  /** Per-request timeout. Default 30 000 ms. */
  timeoutMs?: number;

  /** Retries for GET requests on 429, 503 and connection errors. Default 2. */
  maxRetries?: number;

  /** Custom `fetch` implementation (tests, proxies). Default `globalThis.fetch`. */
  fetch?: Fetch;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;

let browserWarningShown = false;

/** Pegaroute API client. Server-side only: it holds your API key. */
export class Pegaroute {
  protected readonly http: HttpClient;

  /** Supported chains. */
  readonly chains: Chains;

  /** Supported tokens per chain. */
  readonly tokens: Tokens;

  /** Swap providers and their status. */
  readonly providers: Providers;

  /** Swap quotes. */
  readonly quotes: Quotes;

  /** Swap creation and tracking. */
  readonly swaps: Swaps;

  /** Swap history for your integration. */
  readonly transactions: Transactions;

  constructor(options: PegarouteOptions) {
    const { apiKey, baseUrl, timeoutMs = DEFAULT_TIMEOUT_MS, maxRetries = DEFAULT_MAX_RETRIES } = options;

    // Validate options
    if (typeof apiKey !== "string" || apiKey.trim() === "") throw new TypeError("Pegaroute: `apiKey` is required");

    // The key is sent as a header, so reject characters `fetch` would refuse (e.g. a trailing newline from an env file).
    if (!/^[\x21-\x7E]+$/.test(apiKey)) {
      throw new TypeError("Pegaroute: `apiKey` contains whitespace or characters not allowed in an HTTP header");
    }

    if (typeof baseUrl !== "string" || !URL.canParse(baseUrl)) {
      throw new TypeError("Pegaroute: `baseUrl` must be an absolute URL");
    }

    assertIntegerAtLeast("timeoutMs", timeoutMs, 1);

    assertIntegerAtLeast("maxRetries", maxRetries, 0);

    const fetchImpl: Fetch | undefined = options.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") throw new TypeError("Pegaroute: no `fetch` available; pass `options.fetch`");

    // SDK should warn if running in a browser environment as the client holds the API key that can be exposed by client-side code.
    warnIfBrowser();

    this.http = new HttpClient({
      apiKey,
      baseUrl: baseUrl.replace(/\/+$/, ""),
      timeoutMs,
      maxRetries,

      // Wrapped so runtimes that require `this === globalThis` don't throw "Illegal invocation".
      fetch: (url, init) => fetchImpl(url, init),
    });

    // Resource namespaces share the one HTTP client.
    this.chains = new Chains(this.http);
    this.tokens = new Tokens(this.http);
    this.providers = new Providers(this.http);
    this.quotes = new Quotes(this.http);
    this.swaps = new Swaps(this.http);
    this.transactions = new Transactions(this.http);
  }

  /**
   * Returns Pegaroute's health: database, write-ahead log and every provider.
   *
   * Unlike other methods, this does not throw when Pegaroute answers 503 because its database is down:
   * it returns the body with `status: "degraded"` instead. Other failures (401, timeouts, …) still throw.
   *
   * @example
   * const health = await pr.health();
   * if (health.status === "degraded") alert(health);
   */
  health(options?: RequestOptions): Promise<HealthResponse> {
    return this.http.request({ method: "GET", path: "/health", successStatuses: [503] }, options);
  }

  /**
   * Checks that Pegaroute is reachable.
   *
   * @example
   * await pr.ping(); // { response: "pong", timestamp: "…", service: "pegaroute" }
   */
  ping(options?: RequestOptions): Promise<PingResponse> {
    return this.http.request({ method: "GET", path: "/ping" }, options);
  }
}

function warnIfBrowser(): void {
  const g = globalThis as { window?: unknown; document?: unknown };
  if (browserWarningShown || g.window === undefined || g.document === undefined) return;

  browserWarningShown = true;

  console.warn(
    "[pegaroute] The Pegaroute client appears to be running in a browser. " +
      "It sends your API key with every request, so please use it from your backend only.",
  );
}
