import { describe, expect, test } from "bun:test";
import { type InternalSwapStatus, isTerminalStatus, type SwapStatus, toExternalStatus } from "../src/types/status.js";

describe("toExternalStatus", () => {
  test("maps every internal status like Pegaroute does", () => {
    const expected: Record<InternalSwapStatus, SwapStatus> = {
      pending: "pending",
      submitted: "executing",
      executing: "executing",
      confirming: "executing",
      completed: "success",
      failed: "fail",
      refunded: "fail",
    };

    for (const [internal, external] of Object.entries(expected)) {
      expect(toExternalStatus(internal as InternalSwapStatus)).toBe(external);
    }
  });
});

describe("isTerminalStatus", () => {
  test("only finished statuses are terminal, in both sets", () => {
    const terminal = ["success", "fail", "completed", "failed", "refunded"] as const;
    const nonTerminal = ["pending", "executing", "submitted", "confirming"] as const;

    for (const status of terminal) expect(isTerminalStatus(status)).toBe(true);
    for (const status of nonTerminal) expect(isTerminalStatus(status)).toBe(false);
  });
});
