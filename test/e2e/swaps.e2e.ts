/**
 * Quotes and swaps against live providers. The swap is created but never funded, so nothing moves on-chain.
 *
 * One swap, pinned to THORChain (ETH → BTC), walks every swap endpoint. THORChain is the most reliable provider here:
 * the others rate-limit per address or have outages often enough to make the suite flaky.
 */
import { describe, expect, test } from "bun:test";
import { NotFoundError } from "../../src/index.js";
import { assertShape } from "./assert-shape.js";
import {
  createSwapResponseShape,
  getSwapResponseShape,
  quoteResponseShape,
  submitTxHashResponseShape,
  swapEventsResponseShape,
} from "./response-shapes.js";
import { pr } from "./setup.js";
import { createTestSwap } from "./test-swap.js";

describe("quotes and swaps", () => {
  test("quotes.get → swaps.create → swaps.get → swaps.events → swaps.submitTxHash", async () => {
    // Quote, then create the swap on THORChain's route.
    const { quote, created } = await createTestSwap();
    assertShape(quote, quoteResponseShape);
    assertShape(created, createSwapResponseShape);
    expect(created.execution).toMatchObject({ family: "evm", mode: "contract-call" });

    // Read it back, with its audit log.
    const swap = await pr.swaps.get(created.transactionId);
    assertShape(swap, getSwapResponseShape);
    expect(swap.transactionId).toBe(created.transactionId);

    const events = await pr.swaps.events(created.transactionId);
    assertShape(events, swapEventsResponseShape);
    expect(events.events.length).toBeGreaterThan(0);

    // Report a made-up source tx hash; Pegaroute records it without checking the chain.
    const txHash = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}`;

    const submitted = await pr.swaps.submitTxHash(created.transactionId, { txHash });
    assertShape(submitted, submitTxHashResponseShape);
    expect(submitted).toMatchObject({ transactionId: created.transactionId, status: "submitted", txHash });
  });

  test("an unknown swap throws NotFoundError", async () => {
    await expect(pr.swaps.get("00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(NotFoundError);
  });
});
