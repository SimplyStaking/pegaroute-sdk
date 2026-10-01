import type { QuoteFees, RefundInfo, RouteInfo, StreamingProgress } from "./common.js";
import type { InternalSwapStatus, SwapStatus } from "./status.js";
import type { SwapFailure, SwapInput, SwapOutput, SwapTimestamps } from "./swaps.js";

/**
 * Events Pegaroute sends when a swap changes. Every one carries the same {@link TransactionWebhookData}.
 *
 * - `transaction.status_changed`: any other status change (e.g. `pending` → `submitted`).
 * - `transaction.completed`: the swap succeeded.
 * - `transaction.partially_completed`: a streaming swap completed with part of the amount refunded.
 * - `transaction.failed`: the swap failed.
 * - `transaction.refunded`: the swap failed and its funds were refunded.
 * - `transaction.refund_initiated`: a refund started; the swap's status may not be terminal yet.
 */
export type TransactionWebhookEventType =
  | "transaction.status_changed"
  | "transaction.completed"
  | "transaction.partially_completed"
  | "transaction.failed"
  | "transaction.refunded"
  | "transaction.refund_initiated";

/** Streaming progress as webhooks send it: the usual progress plus which sub-swap failed. */
export interface WebhookStreamingProgress extends StreamingProgress {
  /**
   * Which sub-swap failed, for failed, refunded or partially refunded streaming swaps:
   * `"first"` (nothing executed, full refund) or `"subsequent"` (partial output plus partial refund).
   * `null` when nothing failed.
   */
  failureContext: "first" | "subsequent" | null;
}

/** The swap carried by every `transaction.*` webhook: its state after the change, plus the status it changed from. */
export interface TransactionWebhookData {
  /** Swap ID. */
  transactionId: string;

  /** External status after the change. Use this one for business logic. */
  status: SwapStatus;

  /** Internal status after the change, for debugging. */
  internalStatus: InternalSwapStatus;

  /** External status before the change. */
  previousStatus: SwapStatus;

  /** Internal status before the change, for debugging. */
  internalPreviousStatus: InternalSwapStatus;

  /** The route the swap executes on (fewer fields than `swaps.get()`). */
  route: Pick<RouteInfo, "provider" | "subprovider" | "private">;

  /** The source side of the swap (fewer fields than `swaps.get()`). */
  input: Pick<SwapInput, "chain" | "token" | "amount" | "address" | "refundAddress" | "txHash">;

  /** The destination side of the swap. */
  output: SwapOutput;

  /** Fees for the swap. */
  fees: QuoteFees;

  /** When the swap reached each stage. */
  timestamps: SwapTimestamps;

  /** Why the swap failed, or `null`. */
  error: SwapFailure | null;

  /** The refund for a failed swap, or `null`. */
  refund: RefundInfo | null;

  /** Progress of a streaming swap, or `null` for a regular swap. */
  streamingProgress: WebhookStreamingProgress | null;
}

/** A webhook about a swap. Narrow on `event` to react to a specific change. */
export interface TransactionWebhookEvent {
  /** What happened. */
  event: TransactionWebhookEventType;

  /** When Pegaroute created the event (ISO 8601). Retries resend the same value. */
  timestamp: string;

  /** The swap after the change. */
  data: TransactionWebhookData;
}

/** A test webhook, sent from the Pegaroute UI to check your endpoint. */
export interface TestWebhookEvent {
  /** What happened. */
  event: "webhook.test";

  /** When Pegaroute created the event (ISO 8601). */
  timestamp: string;

  /** Who sent the test, and for which integration. */
  data: {
    /** Your integration's ID. */
    integrationId: string;

    /** Always `"Pegaroute test webhook"` today. */
    message: string;

    /** Who sent the test: the operator's email, or `"operator_pat"`. */
    generatedBy: string;
  };
}

/**
 * Any webhook Pegaroute sends, as returned by `verifyWebhook`. Narrow on `event`.
 *
 * Delivery is at-least-once: the same event can arrive more than once, so make handlers idempotent.
 *
 * @example
 * switch (event.event) {
 *   case "transaction.completed":
 *     markPaid(event.data.transactionId);
 *     break;
 *   case "webhook.test":
 *     break;
 * }
 */
export type WebhookEvent = TransactionWebhookEvent | TestWebhookEvent;
