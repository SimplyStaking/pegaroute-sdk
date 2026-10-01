import { sleep } from "./http.js";

/** How {@link pollUntil} fetches a value, when it stops, and what it throws on timeout. */
export interface PollUntilConfig<T> {
  /** Fetches the latest value. Pass `signal` on to the request, so the deadline and the caller can abort it. */
  fetch: (signal: AbortSignal) => Promise<T>;

  /** Whether polling can stop, e.g. the swap reached a terminal status. */
  isDone: (value: T) => boolean;

  /** Wait between the end of one fetch and the start of the next. */
  intervalMs: number;

  /** Hard deadline for the whole wait: it also aborts an in-flight fetch or a pending wait. */
  timeoutMs: number;

  /** The caller's own cancellation. */
  signal?: AbortSignal | undefined;

  /** Builds the error thrown at the deadline, from the latest fetched value (`null` if none returned in time). */
  timeoutError: (lastValue: T | null) => Error;
}

/**
 * Fetches a value at a fixed interval until `isDone` returns `true`, then returns that value.
 *
 * Stops early when:
 * - the deadline passes → throws `timeoutError(lastValue)`
 * - the caller's signal aborts → rethrows its reason, like every other SDK call
 * - a fetch fails → rethrows that error unchanged
 *
 * @example
 * const swap = await pollUntil({
 *   fetch: (signal) => swaps.get(id, { signal }),
 *   isDone: (swap) => isTerminalStatus(swap.status),
 *   intervalMs: 10_000,
 *   timeoutMs: 3_600_000,
 *   timeoutError: (lastSwap) => new WaitTimeoutError({ … }),
 * });
 */
export async function pollUntil<T>(config: PollUntilConfig<T>): Promise<T> {
  // Abort on whichever comes first: the deadline or the caller's own signal.
  const deadline = AbortSignal.timeout(config.timeoutMs);
  const signal = config.signal ? AbortSignal.any([config.signal, deadline]) : deadline;

  // The most recent successful fetch, reported if the deadline passes.
  let lastValue: T | null = null;

  try {
    // Fetch, stop if done, otherwise wait and fetch again.
    for (;;) {
      lastValue = await config.fetch(signal);
      if (config.isDone(lastValue)) return lastValue;

      await sleep(config.intervalMs, signal);
    }
  } catch (error) {
    // The caller's own cancellation propagates unchanged.
    if (config.signal?.aborted) throw config.signal.reason;

    // The deadline cut a fetch or a wait short.
    if (deadline.aborted) throw config.timeoutError(lastValue);

    // A fetch failed for its own reasons (after its own retries).
    throw error;
  }
}
