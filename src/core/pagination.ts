/** How a {@link PagePromise} fetches pages and reads them. */
export interface PagePromiseConfig<Page, Item> {
  /** Fetches the page that starts after `cursor`; `undefined` for the first page. */
  fetchPage: (cursor: string | undefined) => Promise<Page>;

  /** Cursor to start from, when the caller passed one. */
  firstCursor?: string | undefined;

  /** The items on a page. */
  items: (page: Page) => Item[];

  /** The cursor of the next page, or `null` when this is the last page. */
  nextCursor: (page: Page) => string | null;
}

/**
 * The result of a cursor-paginated list: await it for one page, or iterate it for every item.
 *
 * Nothing is requested until it is awaited or iterated. Awaiting and then iterating the same
 * `PagePromise` fetches the first page only once.
 *
 * `.catch()` and `.finally()` only cover the first page. When iterating, later pages are fetched inside
 * the loop, so wrap the loop in `try`/`catch` to handle a failure on any page.
 *
 * @example
 * // One page, as the API returns it
 * const page = await pr.transactions.list({ count: 50 });
 *
 * // Every item, fetching the next page as needed
 * try {
 *   for await (const tx of pr.transactions.list()) console.log(tx.id);
 * } catch (e) {
 *   // any page failed
 * }
 */
export class PagePromise<Page, Item> implements Promise<Page>, AsyncIterable<Item> {
  /** Shown by `Object.prototype.toString`, like `[object Promise]` for a real promise. */
  readonly [Symbol.toStringTag]: string = "PagePromise";

  readonly #config: PagePromiseConfig<Page, Item>;

  /** The first page's request, started on first use and then shared. */
  #firstPage: Promise<Page> | undefined;

  constructor(config: PagePromiseConfig<Page, Item>) {
    this.#config = config;
  }

  /** Resolves to the first page, so `await` works. */
  // biome-ignore lint/suspicious/noThenProperty: being awaitable is the point of this class.
  then<TResult1 = Page, TResult2 = never>(
    onfulfilled?: ((page: Page) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.#getFirstPage().then(onfulfilled, onrejected);
  }

  /** Handles a failure to fetch the first page, like `Promise.prototype.catch`. */
  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): Promise<Page | TResult> {
    return this.#getFirstPage().catch(onrejected);
  }

  /** Runs once the first page is fetched or has failed, like `Promise.prototype.finally`. */
  finally(onfinally?: (() => void) | null): Promise<Page> {
    return this.#getFirstPage().finally(onfinally);
  }

  /** Yields every item of every page, fetching each page when the previous one is used up. */
  async *[Symbol.asyncIterator](): AsyncIterator<Item> {
    // Start with the (possibly already fetched) first page.
    let page = await this.#getFirstPage();

    while (true) {
      yield* this.#config.items(page);

      // Stop after the last page; otherwise fetch the next one.
      const cursor = this.#config.nextCursor(page);
      if (cursor === null) return;

      page = await this.#config.fetchPage(cursor);
    }
  }

  /** Fetches the first page once, however many times it is awaited or iterated. */
  #getFirstPage(): Promise<Page> {
    this.#firstPage ??= this.#config.fetchPage(this.#config.firstCursor);

    return this.#firstPage;
  }
}
