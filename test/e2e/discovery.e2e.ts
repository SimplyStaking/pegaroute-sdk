import { describe, expect, test } from "bun:test";
import { AuthenticationError, Pegaroute } from "../../src/index.js";
import { assertShape } from "./assert-shape.js";
import {
  chainsResponseShape,
  healthResponseShape,
  pingResponseShape,
  providersResponseShape,
  tokensResponseShape,
} from "./response-shapes.js";
import { BASE_URL, pr } from "./setup.js";

describe("discovery", () => {
  test("ping", async () => {
    const ping = await pr.ping();

    assertShape(ping, pingResponseShape);
    expect(ping.response).toBe("pong");
  });

  test("health", async () => {
    const health = await pr.health();

    assertShape(health, healthResponseShape);
    expect(health.providers.length).toBeGreaterThan(0);
  });

  test("chains.list", async () => {
    const response = await pr.chains.list();

    assertShape(response, chainsResponseShape);
    expect(response.chains.some((chain) => chain.id === "ETH")).toBe(true);
  });

  test("tokens.list", async () => {
    const tokens = await pr.tokens.list("ETH");

    assertShape(tokens, tokensResponseShape);
    expect(tokens.chain).toBe("ETH");
  });

  test("providers.list", async () => {
    const providers = await pr.providers.list({ includeDisabled: true });

    assertShape(providers, providersResponseShape);
    expect(providers.providers.length).toBeGreaterThan(0);
  });

  test("an invalid API key throws AuthenticationError", async () => {
    // Arrange: a client with a key Pegaroute doesn't know.
    const unauthenticated = new Pegaroute({ apiKey: "pegasus-not-a-real-key", baseUrl: BASE_URL });

    // Act + Assert
    await expect(unauthenticated.chains.list()).rejects.toBeInstanceOf(AuthenticationError);
  });
});
