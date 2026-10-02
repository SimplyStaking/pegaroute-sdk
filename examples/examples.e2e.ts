/**
 * Wires the frontend and backend examples together and checks they work against Pegaroute (`bun run
 * test:e2e:examples`, which builds the SDK first): the backend example serves /quote → /swap → /swap/:id, and the
 * frontend EVM example turns the swap's `execution` into transactions that a throwaway key signs. Nothing is broadcast
 * and no funds are needed.
 *
 * Standalone: the backend example runs with its own configuration (the PEGAROUTE_EXAMPLE_* variables in `.env`),
 * exactly as you would run it yourself.
 */
import { describe, expect, test } from "bun:test";
import type { CreateSwapParams, CreateSwapResponse, GetSwapResponse, QuoteResponse } from "@pegaroute/sdk/types";
import { parseTransaction } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

// The backend example reads its PEGAROUTE_EXAMPLE_* variables when loaded, and stops if one is missing.
import backend from "./backend/server.js";
import { evmTransactions } from "./frontend/evm.js";

/** Calls a backend example route in-process (no port), returning its JSON body and failing on any non-2xx. */
async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const response = await backend.fetch(
    new Request(`http://backend${path}`, {
      method,
      headers: { "content-type": "application/json" },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    }),
  );

  if (!response.ok) throw new Error(`${method} ${path} failed with ${response.status}: ${await response.text()}`);

  return (await response.json()) as T;
}

/** The fields of a transaction to compare between what was built and what was signed. */
interface ComparableTransaction {
  /** Chain the transaction is for. */
  chainId: number | undefined;

  /** Recipient (the router or the token contract), in lowercase. */
  to: string | undefined;

  /** Calldata: the swap call, or `approve()`. */
  data: string | undefined;

  /** Native amount sent, 0 when none. */
  value: bigint;
}

/**
 * Prepares a transaction for comparison, so a built transaction and the same one signed and decoded again compare
 * equal.
 *
 * Two harmless differences are smoothed out:
 * - Address case: Pegaroute returns checksummed addresses (`0xD37B…`), decoding gives lowercase. Both become
 *   lowercase.
 * - Zero value: a signed transaction omits a value of 0 (e.g. an approval sends no ETH), so it decodes as `undefined`.
 *   Both become `0n`.
 *
 * @example
 * expect(decodedTxs.map(comparable)).toEqual(builtTxs.map(comparable));
 */
function comparable(transaction: {
  chainId?: number | undefined;
  to?: string | null | undefined;
  data?: string | undefined;
  value?: bigint | undefined;
}): ComparableTransaction {
  return {
    chainId: transaction.chainId,
    to: transaction.to?.toLowerCase(),
    data: transaction.data,
    value: transaction.value ?? 0n,
  };
}

describe("examples", () => {
  test.each([
    { pair: "ETH → BTC", fromToken: "ETH", amount: "0.05", transactions: 1 },
    {
      pair: "USDC → BTC",
      fromToken: "USDC-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      amount: "200",
      transactions: 2,
    },
  ])(
    "$pair: backend creates the swap, the frontend's transactions sign",
    async ({ fromToken, amount, transactions }) => {
      // Arrange: a throwaway wallet that is also the swap's sender.
      const wallet = privateKeyToAccount(generatePrivateKey());
      const params: CreateSwapParams = {
        fromChain: "ETH",
        fromToken,
        toChain: "BTC",
        toToken: "BTC",
        amount,
        senderAddress: wallet.address,
        destinationAddress: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
      };

      // Act: quote and create the swap through the backend example, on THORChain's route.
      const quote = await call<QuoteResponse>("POST", "/quote", params);
      const swap = await call<CreateSwapResponse>("POST", "/swap", {
        ...params,
        quoteId: quote.quoteId,
        routeProvider: "thorchain",
      });
      const fetched = await call<GetSwapResponse>("GET", `/swap/${swap.transactionId}`);

      // Act: build the frontend's transactions.
      const builtTxs = evmTransactions(swap.execution);

      // Act: sign each one as the wallet would. A real wallet fills in the nonce, gas and fees itself; nothing is
      // broadcast here, so made-up values are fine. The index acts as the nonce (0, 1, …, as for a fresh wallet).
      const signedTxs = await Promise.all(
        builtTxs.map((transaction, index) =>
          wallet.signTransaction({
            ...transaction,
            nonce: index,
            gas: 500_000n,
            maxFeePerGas: 1n,
            maxPriorityFeePerGas: 1n,
          }),
        ),
      );

      // Assert: GET /swap/:id returns the swap the backend just created.
      expect(fetched.transactionId).toBe(swap.transactionId);

      // Assert: one transaction when swapping ETH (the swap), two when swapping a token (approve, then swap).
      expect(builtTxs.length).toBe(transactions);

      // Assert: each signed transaction, decoded again, is exactly what evmTransactions built.
      const decodedTxs = signedTxs.map((serialized) => parseTransaction(serialized));
      expect(decodedTxs.map(comparable)).toEqual(builtTxs.map(comparable));
    },
  );
});
