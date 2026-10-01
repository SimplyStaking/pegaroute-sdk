import { WaitTimeoutError } from "../core/errors.js";
import type { HttpClient, RequestOptions } from "../core/http.js";
import { pollUntil } from "../core/polling.js";
import { assertIntegerAtLeast } from "../core/validation.js";
import { isTerminalStatus } from "../types/status.js";
import type {
  CreateSwapParams,
  CreateSwapResponse,
  GetSwapResponse,
  SubmitTxHashParams,
  SubmitTxHashResponse,
  SwapEventsResponse,
} from "../types/swaps.js";

/** Default wait between polls: Pegaroute refreshes a swap every 15 s, and rate limits at 10 requests/s. */
const DEFAULT_POLL_INTERVAL_MS = 10_000;

/** Minimum polling interval: Polling faster than this only spends the rate limit: Pegaroute won't have anything new due to caching. */
const MIN_POLL_INTERVAL_MS = 1_000;

/** Default deadline for the whole wait: long enough for slow streaming swaps. */
const DEFAULT_WAIT_TIMEOUT_MS = 3_600_000;

/** Options for {@link Swaps.waitForCompletion}. */
export interface WaitForCompletionOptions {
  /** Wait between polls in milliseconds. Default 10 000; at least 1 000. */
  intervalMs?: number;

  /**
   * Deadline for the whole wait in milliseconds, after which `WaitTimeoutError` is thrown. Default 3 600 000 (1 hour).
   * Each poll still uses the client's own per-request `timeoutMs`.
   */
  timeoutMs?: number;

  /** Stops waiting (and cancels the poll in flight); the signal's reason is thrown. */
  signal?: AbortSignal;
}

/** Swap creation and tracking. Available as `pr.swaps`. */
export class Swaps {
  readonly #http: HttpClient;

  constructor(http: HttpClient) {
    this.#http = http;
  }

  /**
   * Creates a swap and returns what the user must sign.
   *
   * Never retried: the HTTP client only retries GET requests, so a timeout can't create a duplicate swap.
   *
   * Throws `ProviderChangedError` when the quoted route is gone: retry with its `newQuote`.
   * Throws `QuoteExpiredError` when the quote expired, and `BadRequestError` for invalid input or
   * parameters that don't match the quote (`QUOTE_MISMATCH`).
   *
   * @example
   * const swap = await pr.swaps.create({
   *   fromChain: "ETH", fromToken: "ETH", toChain: "BTC", toToken: "BTC", amount: "0.5",
   *   senderAddress: "0xabc…", destinationAddress: "bc1q…",
   *   quoteId: quote.quoteId, routeProvider: quote.routes[0].provider,
   * });
   * // send swap.execution to the frontend for signing
   */
  create(params: CreateSwapParams, options?: RequestOptions): Promise<CreateSwapResponse> {
    // Pegaroute takes the private mode in the query string and rejects it in the body.
    const query = { private: params.private };

    // Listed explicitly so only documented fields are sent.
    const body = {
      fromChain: params.fromChain,
      fromToken: params.fromToken,
      toChain: params.toChain,
      toToken: params.toToken,
      amount: params.amount,
      destinationAddress: params.destinationAddress,
      senderAddress: params.senderAddress,
      refundAddress: params.refundAddress,
      slippageTolerance: params.slippageTolerance,
      streaming: params.streaming,
      quoteId: params.quoteId,
      routeProvider: params.routeProvider,
    };

    return this.#http.request({ method: "POST", path: "/swap", query, body }, options);
  }

  /**
   * Gets a swap's current state. Throws `NotFoundError` for an unknown ID.
   *
   * @example
   * const swap = await pr.swaps.get(transactionId);
   * if (swap.status === "fail") console.log(swap.error?.userMessage, swap.refund);
   */
  get(transactionId: string, options?: RequestOptions): Promise<GetSwapResponse> {
    return this.#http.request({ method: "GET", path: `/swap/${encodeURIComponent(transactionId)}` }, options);
  }

  /**
   * Polls `swaps.get` until the swap reaches a terminal status (`success` or `fail`), then returns it.
   * Webhooks are the better fit for production; use this as a fallback or in scripts.
   *
   * Throws `WaitTimeoutError` (with the last swap seen) if `timeoutMs` passes first. A failing poll is thrown
   * unchanged, after `swaps.get`'s own retries.
   *
   * @example
   * const final = await pr.swaps.waitForCompletion(swap.transactionId);
   * if (final.status === "fail") console.log(final.error?.userMessage, final.refund);
   */
  async waitForCompletion(transactionId: string, options: WaitForCompletionOptions = {}): Promise<GetSwapResponse> {
    const { intervalMs = DEFAULT_POLL_INTERVAL_MS, timeoutMs = DEFAULT_WAIT_TIMEOUT_MS, signal } = options;

    // Validate options before sending anything.
    assertIntegerAtLeast("intervalMs", intervalMs, MIN_POLL_INTERVAL_MS);
    assertIntegerAtLeast("timeoutMs", timeoutMs, 1);

    return pollUntil({
      fetch: (pollSignal) => this.get(transactionId, { signal: pollSignal }),

      isDone: (swap) => isTerminalStatus(swap.status),

      intervalMs,

      timeoutMs,

      signal,

      timeoutError: (lastSwap) =>
        new WaitTimeoutError({
          code: "WAIT_TIMEOUT",
          status: null,
          message: `Swap ${transactionId} did not reach a terminal status within ${timeoutMs}ms`,
          userMessage: "The swap is taking longer than expected. Check its status again later.",
          retryable: false,
          lastSwap,
        }),
    });
  }

  /**
   * Gets a swap's audit log: every internal status change, oldest first.
   *
   * @example
   * const { events } = await pr.swaps.events(transactionId);
   */
  events(transactionId: string, options?: RequestOptions): Promise<SwapEventsResponse> {
    return this.#http.request({ method: "GET", path: `/swap/${encodeURIComponent(transactionId)}/events` }, options);
  }

  /**
   * Reports the hash of the source transaction the user broadcast, so Pegaroute starts tracking it.
   * Returns the internal status `"submitted"`.
   *
   * @example
   * await pr.swaps.submitTxHash(swap.transactionId, { txHash });
   */
  submitTxHash(
    transactionId: string,
    params: SubmitTxHashParams,
    options?: RequestOptions,
  ): Promise<SubmitTxHashResponse> {
    // Listed explicitly so only documented fields are sent.
    const body = { txHash: params.txHash, signature: params.signature };

    return this.#http.request(
      { method: "POST", path: `/swap/${encodeURIComponent(transactionId)}/txhash`, body },
      options,
    );
  }
}
