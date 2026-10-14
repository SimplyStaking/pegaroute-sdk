import { describe, expect, test } from "bun:test";
import { hasQuoteRouteFees, type QuoteRouteFees } from "../src/types/common.js";

describe("hasQuoteRouteFees", () => {
  test("true for full fees", () => {
    const fees: QuoteRouteFees = {
      totalBps: 5,
      totalUsd: "0.5",
      breakdown: { affiliate: { usd: "1", bps: 10 }, route: { usd: "-0.5", bps: -5 }, gas: { usd: "0", bps: 0 } },
    };

    expect(hasQuoteRouteFees(fees)).toBe(true);
  });

  test("true for full fees that are all zero", () => {
    const zero = { usd: "0", bps: 0 };
    const fees: QuoteRouteFees = {
      totalBps: 0,
      totalUsd: "0",
      breakdown: { affiliate: zero, route: zero, gas: zero },
    };

    expect(hasQuoteRouteFees(fees)).toBe(true);
  });

  test("false for {}, which means no fee data", () => {
    expect(hasQuoteRouteFees({})).toBe(false);
  });
});
