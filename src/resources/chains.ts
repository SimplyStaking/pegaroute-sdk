import type { HttpClient, RequestOptions } from "../core/http.js";
import type { ChainsResponse } from "../types/discovery.js";

/** Chains Pegaroute supports. Available as `pr.chains`. */
export class Chains {
  readonly #http: HttpClient;

  constructor(http: HttpClient) {
    this.#http = http;
  }

  /**
   * Lists every supported chain.
   *
   * @example
   * const { chains } = await pr.chains.list();
   */
  list(options?: RequestOptions): Promise<ChainsResponse> {
    return this.#http.request({ method: "GET", path: "/chains" }, options);
  }
}
