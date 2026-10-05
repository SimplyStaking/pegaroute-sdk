# Pegaroute SDK — agent notes

TypeScript SDK (`@pegaroute/sdk`) for the Pegaroute cross-chain swap API: typed access to every API-key endpoint,
webhook verification and status polling. Operator/admin endpoints are out of scope. Usage is in [README.md](README.md).

## Commands

Bun for install, tests and scripts. See the README's [Development](README.md#development) section for e2e setup.

- `bun test`: unit tests (mocked `fetch`, no network)
- `bun run typecheck` / `bun run lint` / `bun run build`: tsc, Biome, tsdown
- `bun run format`: Biome fixes and formatting
- `bun run test:e2e`: REST and webhook e2e against a local Pegaroute (needs `.env`, see `.env.example`)
- `bun run test:e2e:examples`: runs the backend example and EVM signing against a local Pegaroute
- `bun run typecheck:examples`: typechecks `examples/` against the built SDK

## Layout

- `src/client.ts`: `Pegaroute` client, one namespace per resource (`src/resources/*`)
- `src/core/`: HTTP (auth, timeout, GET retries), errors, pagination, polling, option validation
- `src/types/`: domain types and type guards; also the browser-safe `@pegaroute/sdk/types` entry
- `src/webhooks.ts`: `verifyWebhook`
- `test/*.test.ts`: unit tests; `test/e2e/*.e2e.ts`: e2e (ignored by plain `bun test`)
- `examples/`: backend (Hono) and EVM frontend signing (viem); not published

## Conventions

- `@pegaroute/sdk/types` must stay browser-safe: types and guards only, never the client or anything holding the key.
- Types follow what the Pegaroute server returns at runtime (the `../pegasus` source), not the OpenAPI spec. Always
  present but nullable → `T | null`; omitted when unset → `field?: T`. Money is a `string` or `TokenAmount`, never a
  number.
- Never modify `../pegasus`. Its bugs and doc mismatches are reported to its maintainers, not fixed here.
- `isolatedDeclarations` is on: exported functions need explicit return types.
- Style: JSDoc on every exported type, field and function; a blank line between logical blocks and between documented
  fields; a short `//` comment before each non-obvious step saying what and why. Readability first.
- Unit tests only where logic lives (HTTP core, errors, webhooks, pagination, polling, status mapping). Thin resource
  methods are covered by e2e. No snapshot tests.
- Docs, examples and tests use the SDK's own types (`QuoteResponse`, `CreateSwapParams`, …), not hand-written copies.
- Conventional Commits, small reviewable changes.
