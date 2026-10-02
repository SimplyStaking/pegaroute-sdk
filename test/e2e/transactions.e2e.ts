import { describe, expect, test } from "bun:test";
import { assertShape } from "./assert-shape.js";
import { transactionsResponseShape } from "./response-shapes.js";
import { pr } from "./setup.js";
import { createTestSwap } from "./test-swap.js";

describe("transactions", () => {
  test("transactions.list: a page, and iterating across pages", async () => {
    // Arrange: two swaps of our own, so there are at least two rows (one per page) whatever the integration holds.
    const first = await createTestSwap();
    const second = await createTestSwap();
    const newestFirst = [second.created.transactionId, first.created.transactionId];

    // Act: await one page, then iterate with one row per page, so the loop must fetch the next page itself.
    const page = await pr.transactions.list({ count: 1 });

    const iteratedIds: string[] = [];
    for await (const transaction of pr.transactions.list({ count: 1 })) {
      iteratedIds.push(transaction.id);

      // Stop after collecting the two transactions we created. Note: There may be more transactions in the integration, but we only care about the ones we just created.
      if (iteratedIds.length === 2) break;
    }

    // Assert: the page matches the types and holds the newest swap; iterating crossed into the next page.
    assertShape(page, transactionsResponseShape);
    expect(page.transactions.map((transaction) => transaction.id)).toEqual([second.created.transactionId]);
    expect(page.pagination.hasMore).toBe(true);
    expect(iteratedIds).toEqual(newestFirst);
  });
});
