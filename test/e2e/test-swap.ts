/**
 * The one swap shape e2e tests create: ETH → BTC pinned to THORChain, the most reliable provider here (the others
 * rate-limit per address or have outages often enough to make the suite flaky). Swaps are never funded.
 */
import type { CreateSwapParams, CreateSwapResponse, QuoteResponse } from "../../src/index.js";
import { pr } from "./setup.js";

/** A random sender per run: the quote also reaches Squid, which rate-limits per address. */
const SENDER = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(20))).toString("hex")}`;

/** The swap to quote and create. Any valid Bitcoin address works as the destination. */
const TEST_SWAP: CreateSwapParams = {
  fromChain: "ETH",
  fromToken: "ETH",
  toChain: "BTC",
  toToken: "BTC",
  amount: "0.05",
  senderAddress: SENDER,
  destinationAddress: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
};

/** A created test swap, with the quote it was created from. */
export interface TestSwap {
  quote: QuoteResponse;
  created: CreateSwapResponse;
}

/**
 * Quotes the test swap and creates it on THORChain's route.
 * If THORChain didn't quote, the error shows its warnings (e.g. a halted chain), so the failure is easy to read.
 */
export async function createTestSwap(): Promise<TestSwap> {
  const quote = await pr.quotes.get(TEST_SWAP);

  const route = quote.routes.find((candidate) => candidate.provider === "thorchain");
  if (!route) throw new Error(`thorchain returned no route. Warnings: ${JSON.stringify(quote.warnings, null, 2)}`);

  const created = await pr.swaps.create({ ...TEST_SWAP, quoteId: quote.quoteId, routeProvider: route.provider });

  return { quote, created };
}
