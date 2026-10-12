/** Waits `ms`, but stops early (rejecting) if the caller's signal aborts. */
export function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    function onAbort(): void {
      clearTimeout(timer);
      reject(signal?.reason);
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
