/**
 * E2E setup, preloaded once per run by `bun run test:e2e`: checks local Pegaroute is up, provisions an API key,
 * and revokes it when every test has finished. Test files import `pr` (and `operator`, for operator-only setup) from here.
 *
 * Provisioning uses Pegaroute's operator endpoints over HTTP. They are test-only and never part of the SDK.
 *
 * Environment (Bun loads a gitignored `.env` automatically):
 * - `PEGAROUTE_E2E_BASE_URL`: Pegaroute API, default `http://localhost:4000`.
 * - `PEGAROUTE_E2E_OPERATOR_EMAIL` / `PEGAROUTE_E2E_OPERATOR_PASSWORD`: an operator login, used to provision.
 * - `PEGAROUTE_E2E_INTEGRATION_NAME`: an existing integration to create keys on. It needs its providers configured
 *   (fees, affiliates, Squid integrator ID), or quotes return no routes.
 * - `PEGAROUTE_E2E_WEB_ORIGIN`: the web UI's origin, default `http://localhost:4001`. Pegaroute only accepts session
 *   requests that change something from this origin.
 */
import { afterAll } from "bun:test";
import { Pegaroute } from "../../src/index.js";

/** The Pegaroute API every e2e test talks to. */
export const BASE_URL: string = process.env.PEGAROUTE_E2E_BASE_URL ?? "http://localhost:4000";
const WEB_ORIGIN = process.env.PEGAROUTE_E2E_WEB_ORIGIN ?? "http://localhost:4001";

/** The integration to create keys on. It must already exist, with its providers configured. */
const INTEGRATION_NAME = process.env.PEGAROUTE_E2E_INTEGRATION_NAME;

/** An operator session: the cookie to send, plus the `Origin` Pegaroute requires on requests that change something. */
interface OperatorSession {
  headers: Record<string, string>;
}

/** Calls a Pegaroute operator endpoint and returns its JSON body, failing loudly on any non-2xx. */
async function operatorRequest<T>(
  session: OperatorSession,
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(BASE_URL + path, {
    method,
    headers: { ...session.headers, ...(body !== undefined && { "Content-Type": "application/json" }) },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

  if (!response.ok)
    throw new Error(`E2E setup: ${method} ${path} failed with ${response.status}: ${await response.text()}`);

  return (await response.json()) as T;
}

/** Fails fast with a clear message when Pegaroute isn't running. */
async function assertPegarouteIsUp(): Promise<void> {
  try {
    await fetch(`${BASE_URL}/ping`, { signal: AbortSignal.timeout(5_000) });
  } catch {
    throw new Error(
      `E2E setup: Pegaroute is not reachable at ${BASE_URL}. Start it (e.g. \`docker compose up -d --build\` in your ` +
        "Pegaroute checkout) or set PEGAROUTE_E2E_BASE_URL to the correct URL.",
    );
  }
}

/** Logs in as an operator and returns the session to send with every operator request. */
async function login(): Promise<OperatorSession> {
  const email = process.env.PEGAROUTE_E2E_OPERATOR_EMAIL;
  const password = process.env.PEGAROUTE_E2E_OPERATOR_PASSWORD;

  if (!email || !password) {
    throw new Error("E2E setup: set PEGAROUTE_E2E_OPERATOR_EMAIL and PEGAROUTE_E2E_OPERATOR_PASSWORD (e.g. in .env).");
  }

  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok)
    throw new Error(`E2E setup: operator login failed with ${response.status}: ${await response.text()}`);

  // Keep only `name=value` from the session cookie; its attributes (Path, HttpOnly, …) aren't sent back. Pegaroute only needs the cookie itself.
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("E2E setup: operator login returned no session cookie");

  return { headers: { Cookie: cookie, Origin: WEB_ORIGIN } };
}

/**
 * Finds the configured integration and returns its ID. Fails if it doesn't exist: a new integration has no providers
 * configured, so every quote would return no routes and the failure would be much harder to read.
 */
async function findIntegration(session: OperatorSession): Promise<string> {
  if (!INTEGRATION_NAME) {
    throw new Error(
      "E2E setup: set PEGAROUTE_E2E_INTEGRATION_NAME (e.g. in .env) to an integration with its providers configured.",
    );
  }

  const { integrations } = await operatorRequest<{ integrations: Array<{ id: string; name: string }> }>(
    session,
    "GET",
    "/integrations",
  );

  const integration = integrations.find((candidate) => candidate.name === INTEGRATION_NAME);
  if (!integration) {
    throw new Error(
      `E2E setup: no integration named "${INTEGRATION_NAME}". Create it in the Pegaroute UI, configure its ` +
        "providers, or set PEGAROUTE_E2E_INTEGRATION_NAME to an existing one.",
    );
  }

  return integration.id;
}

/** The logged-in operator and its integration, for tests that need operator endpoints (e.g. webhook setup). */
export interface Operator {
  /** ID of the integration the tests run against. */
  integrationId: string;

  /** Calls an operator endpoint as the logged-in operator, failing loudly on any non-2xx. */
  request<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T>;
}

/** Creates a fresh API key on the operator's integration, and registers its revocation for after the last test. */
async function provisionApiKey(operator: Operator): Promise<string> {
  const key = await operator.request<{ id: string; apiKey: string }>(
    "POST",
    `/integrations/${operator.integrationId}/api-keys`,
    { label: `sdk e2e ${new Date().toISOString()}` },
  );

  // Revoke the key once every test file has finished, so runs don't leave live keys behind.
  afterAll(async () => {
    await operator.request("POST", `/integrations/${operator.integrationId}/api-keys/${key.id}/revoke`, {});
  });

  return key.apiKey;
}

// Ensure Pegaroute is up and running before proceeding with the rest of the setup.
await assertPegarouteIsUp();

// Log in as the operator to get a session for subsequent requests.
const session = await login();

/** The logged-in operator and its integration, for tests that need operator endpoints (e.g. webhook setup). */
export const operator: Operator = {
  integrationId: await findIntegration(session),
  request: (method, path, body) => operatorRequest(session, method, path, body),
};

/** The SDK client every e2e test uses, pointed at local Pegaroute, with a key created for this run. */
export const pr: Pegaroute = new Pegaroute({ apiKey: await provisionApiKey(operator), baseUrl: BASE_URL });
