import { describe, expect, it } from "vitest";

import {
  normalizeNetwork,
  resolveEnokiRedirectUrl,
} from "../app/lib/enoki/config";

describe("Enoki client config", () => {
  it("normalizes supported Sui networks", () => {
    expect(normalizeNetwork("mainnet")).toBe("mainnet");
    expect(normalizeNetwork("testnet")).toBe("testnet");
    expect(normalizeNetwork("devnet")).toBe("devnet");
    expect(normalizeNetwork("localnet")).toBe("testnet");
  });

  it("uses an explicitly configured absolute redirect URL", () => {
    expect(
      resolveEnokiRedirectUrl(
        "https://clone-mail.example.com/auth",
        "http://localhost:3000",
      ),
    ).toBe("https://clone-mail.example.com/auth");
  });

  it("resolves relative redirect paths against the current origin", () => {
    expect(resolveEnokiRedirectUrl("/auth", "http://localhost:3000")).toBe(
      "http://localhost:3000/auth",
    );
  });

  it("falls back to the current origin auth route", () => {
    expect(resolveEnokiRedirectUrl("", "http://localhost:3000")).toBe(
      "http://localhost:3000/auth",
    );
  });
});
