/**
 * The public swap status. Use this one for business logic.
 *
 * Returned as `status` by `swaps.get`, `transactions.list` and webhooks.
 */
export type SwapStatus = "pending" | "executing" | "success" | "fail";

/**
 * Pegaroute's detailed internal status, meant for debugging. Steps can be skipped (e.g. `pending` → `completed`).
 *
 * Returned as `internalStatus` by `swaps.get`, `transactions.list` and webhooks, as `status` by
 * `swaps.submitTxHash` (`"submitted"`) and in `swaps.events`. The `transactions.list({ status })` filter takes these values.
 */
export type InternalSwapStatus =
  | "pending"
  | "submitted"
  | "executing"
  | "confirming"
  | "completed"
  | "failed"
  | "refunded";

/** How each internal status maps to the public one (mirrors Pegaroute's own mapping). */
const EXTERNAL_STATUS_BY_INTERNAL: Record<InternalSwapStatus, SwapStatus> = {
  pending: "pending",
  submitted: "executing",
  executing: "executing",
  confirming: "executing",
  completed: "success",
  failed: "fail",
  refunded: "fail",
};

/** Statuses a swap never leaves, in both sets. The two sets share only `pending` and `executing`, which are not terminal. */
const TERMINAL_STATUSES: ReadonlySet<SwapStatus | InternalSwapStatus> = new Set([
  "success",
  "fail",
  "completed",
  "failed",
  "refunded",
]);

/**
 * Converts an internal status to the public one.
 *
 * @example
 * toExternalStatus("submitted"); // "executing"
 * toExternalStatus("refunded"); // "fail" — check the swap's `refund` for details
 */
export function toExternalStatus(status: InternalSwapStatus): SwapStatus {
  return EXTERNAL_STATUS_BY_INTERNAL[status];
}

/**
 * Whether a swap in this status is finished and will not change status again. Accepts either status set.
 *
 * A `refunded` swap's `refund` object may still progress (e.g. `pending` → `completed`) after this returns `true`.
 */
export function isTerminalStatus(status: SwapStatus | InternalSwapStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}
