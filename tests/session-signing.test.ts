import { describe, expect, it, vi } from "vitest";

import {
  createSessionNonce,
  createSignedSessionHeaders,
} from "../app/lib/session/signing";

describe("signed session headers", () => {
  it("creates deterministic nonces from injected randomness", () => {
    const nonce = createSessionNonce(6, (values) => {
      values.set([0, 1, 2, 61, 62, 63]);
      return values;
    });

    expect(nonce).toBe("ABC9AB");
  });

  it("rejects invalid nonce lengths", () => {
    expect(() => createSessionNonce(0)).toThrow(
      "Nonce length must be a positive integer.",
    );
  });

  it("signs the session message into X-Sui headers", async () => {
    const signPersonalMessage = vi.fn(async (bytes: Uint8Array) => ({
      bytes: "message-bytes",
      signature: `sig:${new TextDecoder().decode(bytes)}`,
    }));

    await expect(
      createSignedSessionHeaders({
        address: "0xabc",
        signer: { signPersonalMessage },
        timestamp: 1781238000000,
        nonce: "nonce-123",
      }),
    ).resolves.toEqual({
      "X-Sui-Address": "0xabc",
      "X-Sui-Nonce": "nonce-123",
      "X-Sui-Signature": "sig:create_session:1781238000000:nonce-123",
      "X-Sui-Timestamp": "1781238000000",
    });
  });

  it("requires a Sui address", async () => {
    await expect(
      createSignedSessionHeaders({
        address: "",
        signer: {
          signPersonalMessage: async () => ({
            bytes: "message-bytes",
            signature: "signature",
          }),
        },
      }),
    ).rejects.toThrow("Sui address is required.");
  });
});
