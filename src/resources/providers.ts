import type { HttpClient, RequestOptions } from "../core/http.js";
import type { ListProvidersParams, ProvidersResponse } from "../types/discovery.js";

/** Swap providers behind Pegaroute and their live status. Available as `pr.providers`. */
export class Providers {
  readonly #http: HttpClient;

  constructor(http: HttpClient) {
    this.#http = http;
  }

  /**
   * Lists the providers that are switched on, or every provider with `includeDisabled: true`.
   *
   * @example
   * const { providers } = await pr.providers.list({ includeDisabled: true });
   */
  list(params: ListProvidersParams = {}, options?: RequestOptions): Promise<ProvidersResponse> {
    return this.#http.request(
      { method: "GET", path: "/providers", query: { includeDisabled: params.includeDisabled } },
      options,
    );
  }
}
