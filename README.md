# @pegaroute/sdk

TypeScript SDK for the Pegaroute cross-chain swap API.

> Work in progress — not yet published.

## Install

```sh
npm install @pegaroute/sdk
```

Requires Node.js 22+ (or Bun / Deno).

The client holds your API key, so **only use it on your backend**, never in browser code. Your frontend talks to your
backend, and has the user's wallet sign each swap with your wallet library of choice (e.g. viem). The SDK doesn't sign:
it returns what to sign, and the browser-safe `@pegaroute/sdk/types` (types and type guards, no client) helps your
frontend read it.

## Quote and swap (backend)

```ts
import { type CreateSwapParams, Pegaroute } from "@pegaroute/sdk";

const pr = new Pegaroute({ apiKey: process.env.PEGAROUTE_API_KEY!, baseUrl: process.env.PEGAROUTE_BASE_URL! });

const params = {
  fromChain: "ETH",
  fromToken: "ETH",
  toChain: "BTC",
  toToken: "BTC",
  amount: "0.05",
  senderAddress: "0xabc…",
  destinationAddress: "bc1q…",
} satisfies CreateSwapParams;

// Routes are best first. No routes means no provider can quote the pair: see `quote.warnings`.
const quote = await pr.quotes.get(params);
const best = quote.routes[0];

if (best) {
  const swap = await pr.swaps.create({ ...params, quoteId: quote.quoteId, routeProvider: best.provider });

  // Send `swap.transactionId` and `swap.execution` to the frontend for signing.
}
```

## Sign (frontend, EVM with viem)

`swap.execution` says what the user's wallet must sign. For an EVM router call (e.g. THORChain):

```ts
import { isEvmExecution, isExecutionMode, type SwapExecution } from "@pegaroute/sdk/types";
import { type Address, createWalletClient, custom, type Hex } from "viem";

async function signSwap(execution: SwapExecution) {
  if (!isEvmExecution(execution) || !isExecutionMode(execution, "contract-call")) throw new Error("Not handled here");

  const wallet = createWalletClient({ transport: custom(window.ethereum!) });
  const [account] = await wallet.requestAddresses();

  // If `execution.approval` is set, send the ERC-20 approve first (see examples/frontend/evm.ts).
  const txHash = await wallet.sendTransaction({
    account: account!,
    chain: null,
    to: execution.to as Address,
    data: (execution.data ?? "0x") as Hex,
    value: BigInt(execution.value?.baseUnits ?? 0),
  });

  // POST txHash to your backend.
}
```

## Other execution families and modes

EVM `contract-call` is one of several. `execution` is a union: switch on `family`, then `mode`, never on the provider.

```ts
switch (execution.family) {
  case "evm":    // execution.mode: "contract-call" | "native-transfer" | "erc20-transfer"
  case "utxo":   // "payment-with-memo" | "serialized-tx" (PSBT)
  case "cosmos": // "bank-send" | "msg-deposit" | "msg-execute"
  // … "solana", "sui", "xrp", "stellar", "tron", "near", "hypercore", "cardano", "other"
}

// Or handle one mode across every family, e.g. a single "send to this deposit address" screen:
if (isExecutionMode(execution, "deposit-transfer")) showDeposit(execution.to, execution.amount, execution.memo);
```

The guards `isEvmExecution`, `isUtxoExecution`, `isCosmosExecution`, `isSolanaExecution`, `isSuiExecution`,
`isExecutionFamily` and `isExecutionMode` narrow `execution` to the matching types. Each type documents what to sign.

## Report the tx hash and track status (backend)

```ts
await pr.swaps.submitTxHash(swap.transactionId, { txHash });

// Poll until the swap finishes (default: every 10 s, for up to 1 hour). Or use webhooks.
const final = await pr.swaps.waitForCompletion(swap.transactionId);
if (final.status === "fail") console.log(final.error?.userMessage, final.refund);
```

## Webhooks

**Registering webhooks:** done once in the Pegaroute UI. Set your endpoint URL on the integration and copy its
`whsec_…` secret (shown only when created or rotated).

```ts
import { verifyWebhook, WebhookVerificationError } from "@pegaroute/sdk";

// Verify the raw body: parsing and re-serialising it breaks the signature.
const event = await verifyWebhook({
  rawBody,
  signature: request.headers.get("x-pegasus-signature"),
  secret: process.env.PEGAROUTE_WEBHOOK_SECRET!,
});

if (event.event === "transaction.completed") {
  // `event.data` is fully typed.
}
```

`verifyWebhook` throws `WebhookVerificationError` for a missing or wrong signature: respond 401. Delivery is
at-least-once, so handle events idempotently.

## Errors

Every API error is a `PegarouteError`, with a subclass per status (`NotFoundError`, `RateLimitError`, …).

```ts
import { PegarouteError, ProviderChangedError } from "@pegaroute/sdk";

try {
  await pr.swaps.create({ ...params, quoteId: quote.quoteId, routeProvider: best.provider });
} catch (error) {
  if (error instanceof ProviderChangedError) {
    // The quoted route is gone: show `error.newQuote` to the user, then create the swap with it.
  } else if (error instanceof PegarouteError) {
    console.log(error.code, error.status, error.userMessage); // `userMessage` is safe to show users
  } else {
    throw error;
  }
}
```

GET requests are retried on connection errors and on errors whose `retryable` is `true` (`maxRetries`, default 2).
`retryable` is Pegaroute's own flag, or, when the response doesn't carry one (e.g. a proxy's error page), `true` for
429, 502, 503 and 504. POSTs are never retried.

## Statuses

Pegaroute has two status sets. Use `status` (external) for business logic; `internalStatus` is for debugging.

| internal | external |
|---|---|
| pending | pending |
| submitted, executing, confirming | executing |
| completed | success |
| failed, refunded | fail |

| Call | Returns |
|---|---|
| `swaps.get`, `transactions.list`, webhooks | `status` (external) + `internalStatus` |
| `swaps.create` | `status` (external) |
| `swaps.submitTxHash` | internal (`"submitted"`) |
| `swaps.events` | internal (audit log) |
| `transactions.list({ status })` filter | takes internal values |

`toExternalStatus(internal)` and `isTerminalStatus(status)` are exported from both entry points.

## Examples

[`examples/`](examples) has a minimal backend ([Hono](https://hono.dev)) and the full EVM signing example, including
the ERC-20 approval.

## Development

```sh
bun install
bun test                    # unit tests
bun run typecheck && bun run lint && bun run build
bun run check:package       # package exports and types (after build)
```

CI runs all of the above, plus `typecheck:examples`, on every pull request.

End-to-end tests run against a local Pegaroute (`docker compose up -d --build` in the Pegaroute repo). Copy
[`.env.example`](.env.example) to `.env` and fill it in; it explains what each variable needs.

```sh
bun run test:e2e            # REST endpoints and webhooks
bun run test:e2e:examples   # backend example + EVM signing (nothing is broadcast)
bun run typecheck:examples  # examples against the built SDK
```
