/**
 * Checks a numeric option, with a message naming exactly what is wrong:
 * - `TypeError` if it isn't a number at all (e.g. the string `"5000"`).
 * - `RangeError` if it is a number but not a whole number (e.g. `1500.5`, `NaN`), or below `min`.
 *
 * Used for numeric options such as `timeoutMs` and `maxRetries`. Whole numbers only: `timeoutMs` is passed to
 * `AbortSignal.timeout`, which rejects fractions (e.g. `1500.5`) on every request with Node's own error about a
 * `"delay"` argument. Checking here reports a more valuable error to clients instead.
 *
 * @example
 * assertIntegerAtLeast("timeoutMs", options.timeoutMs, 1);
 */
export function assertIntegerAtLeast(name: string, value: unknown, min: number): void {
  // Wrong type, e.g. a string read from an env var without converting it.
  if (typeof value !== "number") {
    const received = value === null ? "null" : typeof value;
    throw new TypeError(`Pegaroute: \`${name}\` must be a number, received ${received}`);
  }

  // A number, but not a whole one: fractions, NaN and Infinity.
  if (!Number.isInteger(value)) {
    throw new RangeError(`Pegaroute: \`${name}\` must be a whole number, received ${value}`);
  }

  // A whole number, but too small.
  if (value < min) {
    throw new RangeError(`Pegaroute: \`${name}\` must be >= ${min}, received ${value}`);
  }
}
