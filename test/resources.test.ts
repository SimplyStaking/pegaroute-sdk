import { describe, expect, test } from "bun:test";
import { Pegaroute } from "../src/client.js";

/** A fake fetch that records each request and returns an empty successful JSON response. */
function recordingFetch(calls: Array<{ url: string; init: RequestInit }>) {
  return async (url: string, init: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    return Response.json({});
  };
}

describe("userIp forwarding", () => {
  test("quotes.get sends userIp in the query", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const pr = new Pegaroute({
      apiKey: "test-key",
      baseUrl: "https://api.test",
      fetch: recordingFetch(calls),
    });

    await pr.quotes.get({
      fromChain: "ETH",
      fromToken: "ETH",
      toChain: "BTC",
      toToken: "BTC",
      amount: "1",
      userIp: "203.0.113.7",
    });

    expect(calls).toHaveLength(1);
    expect(new URL(calls[0]!.url).searchParams.get("userIp")).toBe("203.0.113.7");
  });

  test("quotes.get sends destinationMemo in the query", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const pr = new Pegaroute({
      apiKey: "test-key",
      baseUrl: "https://api.test",
      fetch: recordingFetch(calls),
    });

    await pr.quotes.get({
      fromChain: "ETH",
      fromToken: "ETH",
      toChain: "CANTON",
      toToken: "CC",
      amount: "1",
      destinationMemo: "payment-id-1",
    });

    expect(calls).toHaveLength(1);
    expect(new URL(calls[0]!.url).searchParams.get("destinationMemo")).toBe("payment-id-1");
  });

  test("quotes.get sends quoteTimeout in the query", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const pr = new Pegaroute({
      apiKey: "test-key",
      baseUrl: "https://api.test",
      fetch: recordingFetch(calls),
    });

    await pr.quotes.get({
      fromChain: "ETH",
      fromToken: "ETH",
      toChain: "BTC",
      toToken: "BTC",
      amount: "1",
      quoteTimeout: -1,
    });

    expect(calls).toHaveLength(1);
    const [call] = calls;
    if (!call) throw new Error("expected quotes.get to send a request");
    expect(new URL(call.url).searchParams.get("quoteTimeout")).toBe("-1");
  });

  test("swaps.create sends destinationMemo in the body", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const pr = new Pegaroute({
      apiKey: "test-key",
      baseUrl: "https://api.test",
      fetch: recordingFetch(calls),
    });

    await pr.swaps.create({
      fromChain: "ETH",
      fromToken: "ETH",
      toChain: "CANTON",
      toToken: "CC",
      amount: "1",
      senderAddress: "0x2222222222222222222222222222222222222222",
      destinationAddress: "canton-address",
      destinationMemo: "payment-id-1",
    });

    expect(calls).toHaveLength(1);
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({ destinationMemo: "payment-id-1" });
  });

  test("swaps.create sends userIp in the body", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const pr = new Pegaroute({
      apiKey: "test-key",
      baseUrl: "https://api.test",
      fetch: recordingFetch(calls),
    });

    await pr.swaps.create({
      fromChain: "ETH",
      fromToken: "ETH",
      toChain: "BTC",
      toToken: "BTC",
      amount: "1",
      senderAddress: "0x2222222222222222222222222222222222222222",
      destinationAddress: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
      userIp: "203.0.113.7",
    });

    expect(calls).toHaveLength(1);
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({ userIp: "203.0.113.7" });
  });
});
