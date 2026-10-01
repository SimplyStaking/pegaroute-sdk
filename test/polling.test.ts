import { describe, expect, test } from "bun:test";
import { Pegaroute } from "../src/client.js";
import { pollUntil } from "../src/core/polling.js";

/** The error the tests' `timeoutError` builds, carrying the last value it was given. */
class TestTimeoutError extends Error {
  constructor(readonly lastValue: number | null) {
    super("timed out");
  }
}

/** A fetch that never returns a value: it only rejects, with the signal's reason, once the signal aborts. */
function hangingFetch(signal: AbortSignal): Promise<number> {
  return new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
}

/** Captures the error a promise rejects with (`toThrow` alone compares only the message, not the class). */
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error("expected the promise to reject");
}

describe("pollUntil", () => {
  test("fetches until done, then returns that value", async () => {
    // Arrange: values counting up from 1; done at 3.
    let calls = 0;

    // Act
    const value = await pollUntil({
      fetch: async () => ++calls,
      isDone: (value) => value === 3,
      intervalMs: 1,
      timeoutMs: 1_000,
      timeoutError: (lastValue) => new TestTimeoutError(lastValue),
    });

    // Assert: stopped at the first done value.
    expect(value).toBe(3);
    expect(calls).toBe(3);
  });

  test("throws the timeout error with the most recent successful value at the deadline", async () => {
    // Arrange: never done. The first two polls return 1 and 2; the third hangs until the deadline cuts it off.
    let calls = 0;

    // Act
    const error = await rejection(
      pollUntil({
        fetch: (signal) => (++calls < 3 ? Promise.resolve(calls) : hangingFetch(signal)),
        isDone: () => false,
        intervalMs: 1,
        timeoutMs: 50,
        timeoutError: (lastValue) => new TestTimeoutError(lastValue),
      }),
    );

    // Assert: the deadline aborted the third poll, and the error carries the second (latest successful) one.
    expect(error).toBeInstanceOf(TestTimeoutError);
    expect(calls).toBe(3);
    expect((error as TestTimeoutError).lastValue).toBe(2);
  });

  test("aborts an in-flight fetch at the deadline, with no last value if none returned", async () => {
    // Act: the first fetch never returns.
    const error = await rejection(
      pollUntil({
        fetch: hangingFetch,
        isDone: () => false,
        intervalMs: 1,
        timeoutMs: 10,
        timeoutError: (lastValue) => new TestTimeoutError(lastValue),
      }),
    );

    // Assert
    expect(error).toBeInstanceOf(TestTimeoutError);
    expect((error as TestTimeoutError).lastValue).toBeNull();
  });

  test("rethrows the caller's abort reason and a failed fetch unchanged", async () => {
    // Arrange: a caller that cancels, and a fetch that fails.
    const controller = new AbortController();
    const reason = new Error("cancelled by caller");
    const fetchError = new Error("fetch failed");

    // Act
    const cancelled = rejection(
      pollUntil({
        fetch: hangingFetch,
        isDone: () => false,
        intervalMs: 1,
        timeoutMs: 1_000,
        signal: controller.signal,
        timeoutError: (lastValue) => new TestTimeoutError(lastValue),
      }),
    );
    controller.abort(reason);

    const failed = rejection(
      pollUntil({
        fetch: (): Promise<number> => Promise.reject(fetchError),
        isDone: () => false,
        intervalMs: 1,
        timeoutMs: 1_000,
        timeoutError: (lastValue) => new TestTimeoutError(lastValue),
      }),
    );

    // Assert
    expect(await cancelled).toBe(reason);
    expect(await failed).toBe(fetchError);
  });
});

describe("swaps.waitForCompletion", () => {
  test("rejects an interval below 1000ms before sending any request", async () => {
    // Arrange: a fake `fetch` that counts requests, so we can check none were sent.
    let requests = 0;
    const pr = new Pegaroute({
      apiKey: "pegasus-test",
      baseUrl: "https://api.test",
      fetch: async () => {
        requests++;
        return new Response("{}");
      },
    });

    // Act
    const error = await rejection(pr.swaps.waitForCompletion("tx-1", { intervalMs: 500 }));

    // Assert
    expect(error).toBeInstanceOf(RangeError);
    expect(requests).toBe(0);
  });
});
