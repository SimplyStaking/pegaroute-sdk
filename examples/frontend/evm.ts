/**
 * Frontend signing for EVM swaps that call a router contract (e.g. THORChain), with viem. Only this execution mode
 * (`evm` + `contract-call`, with its optional ERC-20 approval) is covered; other modes and chain families aren't.
 *
 * Your backend creates the swap and hands `swap.execution` to the browser (see examples/backend). Browser code should
 * import only `@pegaroute/sdk/types`: no client and no API key, so the key never reaches the browser.
 *
 * Two parts:
 * - `evmTransactions(execution)`: the transactions to send, built from `swap.execution`, in order (approval first).
 * - `sendEvmSwap(execution)`: browser-only. Asks the user's wallet to sign and send those transactions, and returns
 *   the swap's tx hash.
 */
import { isExecutionFamily, isExecutionMode, type SwapExecution } from "@pegaroute/sdk/types";
import {
  type Address,
  createPublicClient,
  createWalletClient,
  custom,
  type EIP1193Provider,
  encodeFunctionData,
  erc20Abi,
  type Hash,
  type Hex,
} from "viem";

declare global {
  interface Window {
    /** The injected wallet (MetaMask and others). */
    ethereum?: EIP1193Provider;
  }
}

/** One transaction for the user's wallet to send. */
export interface EvmTransaction {
  chainId: number;
  to: Address;
  data: Hex;
  value: bigint;
}

/**
 * The transactions to send for a swap, in order: an ERC-20 approval when the swap spends a token, then the swap.
 *
 * @example
 * const [approval, swapTx] = evmTransactions(swap.execution); // approval only when swapping a token
 */
export function evmTransactions(execution: SwapExecution): EvmTransaction[] {
  // This example only covers router contract calls; other execution modes need other wallet calls.
  if (!isExecutionFamily(execution, "evm") || !isExecutionMode(execution, "contract-call")) {
    throw new Error(`This example doesn't handle ${execution.family} ${execution.mode} swaps`);
  }

  const transactions: EvmTransaction[] = [];

  // Swapping a token (e.g. USDC): first allow the router to spend that amount.
  if (execution.approval) {
    const { tokenAddress, spender, amount } = execution.approval;

    transactions.push({
      chainId: execution.chainId,
      to: tokenAddress as Address,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [spender as Address, BigInt(amount.baseUnits)],
      }),
      value: 0n,
    });
  }

  // The swap: call the router, sending the native amount when swapping ETH itself.
  transactions.push({
    chainId: execution.chainId,
    to: execution.to as Address,
    data: (execution.data ?? "0x") as Hex,
    value: BigInt(execution.value?.baseUnits ?? 0),
  });

  return transactions;
}

/**
 * Sends a swap's transactions from the user's wallet and returns the swap transaction's hash.
 *
 * Post that hash to your backend (`POST /swap/:id/txhash` in the backend example), which reports it to Pegaroute with
 * `swaps.submitTxHash` so Pegaroute starts tracking the swap.
 *
 * The connected account must be the swap's `senderAddress`.
 */
export async function sendEvmSwap(execution: SwapExecution): Promise<Hash> {
  if (!window.ethereum) throw new Error("No EVM wallet found");

  // Connect to the injected wallet, on the swap's chain.
  const transport = custom(window.ethereum);
  const wallet = createWalletClient({ transport });
  const chain = createPublicClient({ transport });

  const [account] = await wallet.requestAddresses();
  if (!account) throw new Error("No wallet account connected");

  const transactions = evmTransactions(execution);

  // The approval and the swap are on the same chain, so switch once, to the first transaction's chain.
  const [first] = transactions;
  if (!first) throw new Error("No transactions to send");

  await wallet.switchChain({ id: first.chainId });

  // Send each transaction, waiting for it to be mined so the swap only runs once its approval is in place.
  let hash: Hash | undefined;

  for (const { to, data, value } of transactions) {
    hash = await wallet.sendTransaction({ account, chain: null, to, data, value });
    await chain.waitForTransactionReceipt({ hash });
  }

  return hash as Hash;
}
