import { describe, expect, test } from "bun:test";
import { assertIntegerAtLeast } from "../src/core/validation.js";

describe("assertIntegerAtLeast", () => {
  test.each([
    // Not a number at all → TypeError.
    ["5000", TypeError, "Pegaroute: `timeoutMs` must be a number, received string"],
    [null, TypeError, "Pegaroute: `timeoutMs` must be a number, received null"],
    [undefined, TypeError, "Pegaroute: `timeoutMs` must be a number, received undefined"],
    [true, TypeError, "Pegaroute: `timeoutMs` must be a number, received boolean"],

    // A number, but not a whole one → RangeError.
    [1500.5, RangeError, "Pegaroute: `timeoutMs` must be a whole number, received 1500.5"],
    [Number.NaN, RangeError, "Pegaroute: `timeoutMs` must be a whole number, received NaN"],
    [Number.POSITIVE_INFINITY, RangeError, "Pegaroute: `timeoutMs` must be a whole number, received Infinity"],

    // A whole number below the minimum → RangeError.
    [0, RangeError, "Pegaroute: `timeoutMs` must be >= 1, received 0"],
    [-1, RangeError, "Pegaroute: `timeoutMs` must be >= 1, received -1"],
  ])("rejects %p", (value, ErrorClass, message) => {
    // Act: capture the error (`toThrow` alone compares only the message, not the class).
    let error: unknown;
    try {
      assertIntegerAtLeast("timeoutMs", value, 1);
    } catch (e) {
      error = e;
    }

    // Assert: the right error class, with a message naming the exact problem.
    expect(error).toBeInstanceOf(ErrorClass);
    expect(error).toMatchObject({ message });
  });

  test("accepts whole numbers at or above the minimum", () => {
    // Act + Assert: the minimum itself, a typical value, and a minimum of 0 (as for `maxRetries`).
    expect(() => assertIntegerAtLeast("timeoutMs", 1, 1)).not.toThrow();
    expect(() => assertIntegerAtLeast("timeoutMs", 30_000, 1)).not.toThrow();
    expect(() => assertIntegerAtLeast("maxRetries", 0, 0)).not.toThrow();
  });
});
