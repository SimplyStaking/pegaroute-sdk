import type { HttpClient, RequestOptions } from "../core/http.js";
import { PagePromise } from "../core/pagination.js";
import type { ListTransactionsParams, Transaction, TransactionsResponse } from "../types/transactions.js";

/** Swap history for your integration. Available as `pr.transactions`. */
export class Transactions {
  readonly #http: HttpClient;

  constructor(http: HttpClient) {
    this.#http = http;
  }

  /**
   * Lists your swaps, newest first. Await it for one page, or iterate it with `for await` to walk every page.
   *
   * @example
   * // One page
   * const { transactions, pagination } = await pr.transactions.list({ count: 50 });
   *
   * // Every failed swap, across pages
   * for await (const tx of pr.transactions.list({ status: "failed" })) {
   *   console.log(tx.id, tx.error?.userMessage);
   * }
   */
  list(params: ListTransactionsParams = {}, options?: RequestOptions): PagePromise<TransactionsResponse, Transaction> {
    return new PagePromise({
      // Fetch one page. Filters are listed explicitly so only documented params are sent.
      fetchPage: (cursor) =>
        this.#http.request<TransactionsResponse>(
          {
            method: "GET",
            path: "/transactions",
            query: {
              status: params.status,
              provider: params.provider,
              startTime: params.startTime,
              endTime: params.endTime,
              count: params.count,
              cursor,
            },
          },
          options,
        ),

      firstCursor: params.cursor,

      items: (page) => page.transactions,

      nextCursor: (page) => (page.pagination.hasMore ? page.pagination.nextCursor : null),
    });
  }
}
