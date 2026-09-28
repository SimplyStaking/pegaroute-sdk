import type { TokenAmount } from "./common.js";

/** An ERC-20 approval that must be sent before an EVM `contract-call`. */
export interface EvmApproval {
  /** Address to approve (router or spender contract). */
  spender: string;

  /** ERC-20 token contract address. */
  tokenAddress: string;

  /** Exact amount to approve. */
  amount: TokenAmount;
}

/**
 * Sign and send an EVM transaction.
 *
 * - `contract-call`: send `to` / `data` / `value`, after the `approval` if there is one.
 * - `native-transfer`: send `value` of the native gas token to `to`.
 * - `erc20-transfer`: send `transferAmount` of the source token to `to`.
 */
export interface EvmSwapExecution {
  family: "evm";

  mode: "contract-call" | "native-transfer" | "erc20-transfer";

  /** When present, sign `message` with EIP-191 `personal_sign` first and submit the signature with the tx hash. */
  signature?: { method: "personal_sign"; message: string };

  /** EVM chain ID the transaction must be sent on. */
  chainId: number;

  /** Recipient: a contract for `contract-call`, otherwise the deposit address. */
  to: string;

  /** Calldata for `contract-call`; `null` otherwise. */
  data: string | null;

  /** Native gas token amount to send with the transaction, if any. */
  value: TokenAmount | null;

  /** Suggested gas limit, if the provider supplies one. */
  gasLimit: string | null;

  /** Opaque memo or deposit instructions, if any. */
  memo: string | null;

  /** ERC-20 approval required before a `contract-call`; `null` otherwise. */
  approval: EvmApproval | null;

  /** Exact ERC-20 amount for `erc20-transfer`; `null` otherwise. */
  transferAmount: TokenAmount | null;
}

/** Send `amount` to `to` with `memo` as an OP_RETURN output. Used for BTC, LTC, BCH, DOGE, DASH and ZEC. */
export interface UtxoSwapExecution {
  family: "utxo";

  mode: "payment-with-memo";

  /** Deposit address. */
  to: string;

  /** Exact amount to send. */
  amount: TokenAmount;

  /** Memo to include as OP_RETURN, if any. */
  memo: string | null;

  /** Advisory fee-rate hint (THORChain/Maya). The wallet chooses the actual fee. */
  gasRate: string | null;
}

/** Send a standard Cosmos `MsgSend` to the provider's inbound address. */
export interface CosmosBankSendSwapExecution {
  family: "cosmos";

  mode: "bank-send";

  /** Inbound address. */
  to: string;

  /** Exact amount to send. */
  amount: TokenAmount;

  /** Transaction memo, if any. */
  memo: string | null;
}

/** Send a native `MsgDeposit` on THORChain or Maya. */
export interface CosmosMsgDepositSwapExecution {
  family: "cosmos";

  mode: "msg-deposit";

  /** Inbound address. */
  to: string;

  /** Protocol asset for the deposit coin, e.g. `"THOR.RUNE"`. */
  asset: string;

  /** Decimals to write into the deposit coin. */
  assetDecimals: number;

  /** Exact amount to deposit. */
  amount: TokenAmount;

  /** Transaction memo, if any. */
  memo: string | null;
}

/** Sign and broadcast a provider-built Cosmos message (IBC transfer or CosmWasm execute) unchanged. */
export interface CosmosMsgExecuteSwapExecution {
  family: "cosmos";

  mode: "msg-execute";

  /** JSON-encoded `{ typeUrl, value }` message. Pass it through as-is; never rebuild it. */
  messageJson: string;

  /** Transaction memo, if any. */
  memo: string | null;

  /** Advisory gas price, e.g. `"0.025uosmo"`. The wallet chooses the actual fee. */
  gasPrice: string | null;

  /** Advisory gas simulation multiplier, if the provider supplies one. */
  gasMultiplier: number | null;
}

/** Sign a fully built transaction: Solana base64, Sui transaction, Bitcoin hex PSBT or Stellar XDR. */
export interface SerializedSwapExecution {
  family: "solana" | "sui" | "utxo" | "stellar";

  mode: "serialized-tx";

  /** The encoded transaction to sign. */
  serializedTransaction: string;

  /** Minimum swap output encoded in the transaction (not the input amount), if known. */
  minOut: TokenAmount | null;
}

/** Sign a JSON-described XRPL or Stellar payment. */
export interface JsonSwapExecution {
  family: "xrp" | "stellar";

  mode: "transaction-json";

  /** Destination address. */
  to: string;

  /** JSON-encoded payment fields. Keep every memo field. */
  transactionJson: string;
}

/** Send `amount` to a deposit address on a chain with its own execution family. */
export interface NamedDepositSwapExecution {
  family: "solana" | "sui" | "xrp" | "tron" | "near" | "hypercore" | "cardano";

  mode: "deposit-transfer";

  /** Deposit address. */
  to: string;

  /** Exact amount to send. */
  amount: TokenAmount;

  /** Memo to attach, if any. */
  memo: string | null;
}

/** Send `amount` to a deposit address on a chain without a dedicated execution family (see `chain`). */
export interface OtherDepositSwapExecution {
  family: "other";

  mode: "deposit-transfer";

  /** Pegaroute chain ID, e.g. `"APTOS"`. */
  chain: string;

  /** Deposit address. */
  to: string;

  /** Exact amount to send. */
  amount: TokenAmount;

  /** Memo to attach, if any. */
  memo: string | null;
}

/**
 * What the user's wallet must sign to fund a swap. Switch on `family` and `mode`, never on the provider name.
 *
 * @example
 * if (isEvmExecution(execution)) {
 *   // execution is EvmSwapExecution
 * } else if (isUtxoExecution(execution)) {
 *   // execution.mode is "payment-with-memo" | "serialized-tx"
 * }
 */
export type SwapExecution =
  | EvmSwapExecution
  | UtxoSwapExecution
  | CosmosBankSendSwapExecution
  | CosmosMsgDepositSwapExecution
  | CosmosMsgExecuteSwapExecution
  | SerializedSwapExecution
  | JsonSwapExecution
  | NamedDepositSwapExecution
  | OtherDepositSwapExecution;

/** Every execution family, e.g. `"evm"` or `"utxo"`. */
export type ExecutionFamily = SwapExecution["family"];

/**
 * The execution variants of one family, with `family` narrowed to it.
 *
 * `Extract` can't be used here: variants shared by several families (e.g. `SerializedSwapExecution`)
 * would be dropped. The intersection keeps them and removes variants of other families.
 *
 * @example
 * ExecutionOfFamily<"utxo"> // UtxoSwapExecution | (SerializedSwapExecution & { family: "utxo" })
 */
export type ExecutionOfFamily<F extends ExecutionFamily> = SwapExecution & { family: F };

/** Every execution mode, e.g. `"contract-call"` or `"deposit-transfer"`. */
export type ExecutionMode = SwapExecution["mode"];

/**
 * The execution variants of one mode, across all families, with `mode` narrowed to it.
 *
 * Uses an intersection for the same reason as {@link ExecutionOfFamily}: `EvmSwapExecution` covers three modes.
 *
 * @example
 * ExecutionOfMode<"deposit-transfer"> // NamedDepositSwapExecution | OtherDepositSwapExecution
 */
export type ExecutionOfMode<M extends ExecutionMode> = SwapExecution & { mode: M };

/**
 * Narrows an execution to the variants of one mode, whatever the family.
 * Within a single family, a `switch` on `mode` is usually clearer.
 *
 * @example
 * if (isExecutionMode(execution, "deposit-transfer")) {
 *   showDepositAddress(execution.to, execution.amount.display, execution.memo); // any chain
 * }
 */
export function isExecutionMode<M extends ExecutionMode>(
  execution: SwapExecution,
  mode: M,
): execution is ExecutionOfMode<M> {
  return execution.mode === mode;
}

/** Narrows an execution to the variants of one family. Prefer the named guards (`isEvmExecution`, …) where they exist. */
export function isExecutionFamily<F extends ExecutionFamily>(
  execution: SwapExecution,
  family: F,
): execution is ExecutionOfFamily<F> {
  return execution.family === family;
}

/** EVM chains: contract call, native transfer or ERC-20 transfer. */
export function isEvmExecution(execution: SwapExecution): execution is ExecutionOfFamily<"evm"> {
  return isExecutionFamily(execution, "evm");
}

/** Bitcoin-like chains: payment with memo, or a PSBT (`serialized-tx`). */
export function isUtxoExecution(execution: SwapExecution): execution is ExecutionOfFamily<"utxo"> {
  return isExecutionFamily(execution, "utxo");
}

/** Cosmos chains, including THORChain and Maya: bank send, msg-deposit or msg-execute. */
export function isCosmosExecution(execution: SwapExecution): execution is ExecutionOfFamily<"cosmos"> {
  return isExecutionFamily(execution, "cosmos");
}

/** Solana: serialized transaction or deposit transfer. */
export function isSolanaExecution(execution: SwapExecution): execution is ExecutionOfFamily<"solana"> {
  return isExecutionFamily(execution, "solana");
}

/** Sui: serialized transaction or deposit transfer. */
export function isSuiExecution(execution: SwapExecution): execution is ExecutionOfFamily<"sui"> {
  return isExecutionFamily(execution, "sui");
}
