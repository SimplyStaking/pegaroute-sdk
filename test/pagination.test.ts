import { describe, expect, test } from "bun:test";
import { PagePromise } from "../src/core/pagination.js";

/** A page shaped like `/transactions`: items plus cursor pagination. */
type Page = { items: string[]; pagination: { nextCursor: string | null; hasMore: boolean } };

/** A `PagePromise` over the given pages, served in order, that records the cursor of every request. */
function pagePromise(pages: Page[], firstCursor?: string): { list: PagePromise<Page, string>; cursors: unknown[] } {
  const cursors: unknown[] = [];

  const list = new PagePromise<Page, string>({
    fetchPage: async (cursor) => {
      cursors.push(cursor);

      // Fail loudly if the code under test requests more pages than the test expects.
      const page = pages.shift();
      if (!page) throw new Error("unexpected request");

      return page;
    },
    firstCursor,
    items: (page) => page.items,
    nextCursor: (page) => (page.pagination.hasMore ? page.pagination.nextCursor : null),
  });

  return { list, cursors };
}

describe("PagePromise", () => {
  test("iterates every item across pages, passing each page's cursor to the next request", async () => {
    // Arrange: two full pages, then a last one.
    const { list, cursors } = pagePromise(
      [
        { items: ["a", "b"], pagination: { nextCursor: "b", hasMore: true } },
        { items: ["c", "d"], pagination: { nextCursor: "d", hasMore: true } },
        { items: ["e"], pagination: { nextCursor: null, hasMore: false } },
      ],
      "start",
    );

    // Act
    const items: string[] = [];
    for await (const item of list) items.push(item);

    // Assert: every item in order, starting from the caller's cursor and stopping after the last page.
    expect(items).toEqual(["a", "b", "c", "d", "e"]);
    expect(cursors).toEqual(["start", "b", "d"]);
  });

  test("awaits to the first page as-is, and reuses it when iterated afterwards", async () => {
    // Arrange: two pages.
    const first: Page = { items: ["a"], pagination: { nextCursor: "a", hasMore: true } };
    const { list, cursors } = pagePromise([first, { items: ["b"], pagination: { nextCursor: null, hasMore: false } }]);

    // Act: await first, then iterate the same object.
    const page = await list;

    const items: string[] = [];
    for await (const item of list) items.push(item);

    // Assert: the first page came back untouched and was fetched only once.
    expect(page).toBe(first);
    expect(items).toEqual(["a", "b"]);
    expect(cursors).toEqual([undefined, "a"]);
  });
});
