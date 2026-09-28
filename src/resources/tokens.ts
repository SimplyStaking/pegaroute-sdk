import type { HttpClient, RequestOptions } from "../core/http.js";
import type { TokensResponse } from "../types/discovery.js";

/** Tokens Pegaroute recognises on each chain. Available as `pr.tokens`. */
export class Tokens {
  readonly #http: HttpClient;

  constructor(http: HttpClient) {
    this.#http = http;
  }

  /**
   * Lists the tokens on one chain. Throws `BadRequestError` (`VALIDATION_ERROR`) for an unknown chain.
   *
   * @param chain A chain ID from `chains.list()`; case is ignored.
   *
   * @example
   * const { tokens } = await pr.tokens.list("SOL");
   */
  list(chain: string, options?: RequestOptions): Promise<TokensResponse> {
    return this.#http.request({ method: "GET", path: "/tokens", query: { chain } }, options);
  }
}
