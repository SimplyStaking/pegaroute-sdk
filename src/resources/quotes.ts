import type { HttpClient, RequestOptions } from "../core/http.js";
import type { GetQuoteParams, QuoteResponse } from "../types/quotes.js";

/** Swap quotes. Available as `pr.quotes`. */
export class Quotes {
  readonly #http: HttpClient;

  constructor(http: HttpClient) {
    this.#http = http;
  }

  /**
   * Gets routes for a swap from every available provider.
   *
   * Throws `BadRequestError` for invalid input or an amount too low for every provider (`AMOUNT_TOO_LOW`),
   * and `ServiceUnavailableError` when the chain is disabled (`CHAIN_DISABLED`).
   *
   * @example
   * const quote = await pr.quotes.get({ fromChain: "ETH", fromToken: "ETH", toChain: "BTC", toToken: "BTC", amount: "0.5" });
   * const best = quote.routes[0];
   */
  get(params: GetQuoteParams, options?: RequestOptions): Promise<QuoteResponse> {
    // Listed explicitly so only documented params are sent.
    const query = {
      fromChain: params.fromChain,
      fromToken: params.fromToken,
      toChain: params.toChain,
      toToken: params.toToken,
      amount: params.amount,
      private: params.private,
      destinationAddress: params.destinationAddress,
      senderAddress: params.senderAddress,
      refundAddress: params.refundAddress,
    };

    return this.#http.request({ method: "GET", path: "/quote", query }, options);
  }
}
