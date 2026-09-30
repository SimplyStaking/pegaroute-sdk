import type { HttpClient, RequestOptions } from "../core/http.js";
import type {
  CreateSwapParams,
  CreateSwapResponse,
  GetSwapResponse,
  SubmitTxHashParams,
  SubmitTxHashResponse,
  SwapEventsResponse,
} from "../types/swaps.js";

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
