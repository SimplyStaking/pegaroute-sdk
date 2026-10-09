/**
 * Smoke test of the built package on real Node (the unit tests run on Bun, whose `fetch` and `AbortSignal` differ).
 *
 * Imports the SDK by its package name, so it goes through `exports` and `dist/` like an integrator's code would.
 * Run with `bun run test:node` (builds first). Node only: no Bun APIs, no dependencies. Named `*.node.mjs`, not
 * `*.test.*`, so plain `bun test` skips it.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { after, before, beforeEach, describe, test } from "node:test";
import { Pegaroute, PegarouteError, TimeoutError } from "@pegaroute/sdk";
import { isExecutionMode } from "@pegaroute/sdk/types";

const require = createRequire(import.meta.url);

/** A `/ping` body like Pegaroute's. */
const PONG = { response: "pong", timestamp: "2026-10-09T00:00:00.000Z", service: "pegaroute" };

/** What the local server does with each request; every test sets its own. */
let handle = (_request, _response) => {};

/** How many requests the local server received in the current test. */
let requests = 0;

/** A local HTTP server standing in for Pegaroute. */
const server = createServer((request, response) => {
  requests++;
  handle(request, response);
});

/** A client pointed at the local server; override only what a test cares about. */
function client(options = {}) {
  const { port } = server.address();

  return new Pegaroute({ apiKey: "test-key", baseUrl: `http://127.0.0.1:${port}`, ...options });
}

/** Never answers, like a server that hangs. The client's timeout or abort ends the request. */
function hang() {}

describe("built package on Node", () => {
  before(() => new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)));

  // Drop requests that were left hanging, so the server can shut down.
  after(() => {
    server.closeAllConnections();
    server.close();
  });

  beforeEach(() => {
    requests = 0;
  });

  test("import and require() load the same copy, so instanceof works across them", () => {
    // Load both entries the CommonJS way (Node 22.12+ can `require()` ESM).
    const required = require("@pegaroute/sdk");
    const requiredTypes = require("@pegaroute/sdk/types");

    // One class per process: an error built by one copy is an instance of the other's class.
    const init = { code: "TIMEOUT", status: null, message: "timed out", userMessage: "", retryable: true };
    const error = new required.TimeoutError(init);

    assert.equal(required.PegarouteError, PegarouteError);
    assert.ok(error instanceof PegarouteError);
    assert.equal(requiredTypes.isExecutionMode, isExecutionMode);
  });

  test("a response slower than timeoutMs becomes a TimeoutError", async () => {
    handle = hang;

    await assert.rejects(client({ timeoutMs: 100, maxRetries: 0 }).ping(), TimeoutError);
    assert.equal(requests, 1);
  });

  test("the caller's abort is rethrown unchanged, and not retried", async () => {
    handle = hang;

    // Cancel shortly after the request starts.
    const controller = new AbortController();
    const reason = new Error("cancelled by caller");
    setTimeout(() => controller.abort(reason), 50);

    await assert.rejects(client().ping({ signal: controller.signal }), (error) => error === reason);
    assert.equal(requests, 1);
  });

  test("a 503 is retried, and the retry's body is returned", async () => {
    // First a proxy-style 503 without a body (retryable by its status), then a normal answer.
    handle = (_request, response) => {
      if (requests === 1) return response.writeHead(503, { "Retry-After": "0" }).end();

      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(PONG));
    };

    assert.deepEqual(await client().ping(), PONG);
    assert.equal(requests, 2);
  });
});
