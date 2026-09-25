import { type Fetch, HttpClient } from "./core/http.js";

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

    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new TypeError("Pegaroute: `timeoutMs` must be > 0");

    if (!Number.isInteger(maxRetries) || maxRetries < 0) {
      throw new TypeError("Pegaroute: `maxRetries` must be an integer >= 0");
    }

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
