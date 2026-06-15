import { describe, expect, it, vi } from "vitest";

import {
  createBucket,
  decryptBytes,
  downloadFile,
  encryptBytes,
  uploadFile,
} from "../app/lib/server/harbor/client";
import {
  createHarborApiKeyWithSession,
  createHarborSession,
} from "../app/lib/server/harbor/api-key";
import {
  decryptSecretWithKey,
  encryptSecretWithKey,
} from "../app/lib/server/secret-box";

const credentials = {
  apiKey: "hbr_test",
  spaceId: "space-1",
  privateKey: "suiprivkey-test",
};

describe("Harbor storage adapter", () => {
  it("encrypts and decrypts mailbox bytes", async () => {
    const original = new TextEncoder().encode("hello harbor");
    const encrypted = await encryptBytes(credentials, original);
    expect(new TextDecoder().decode(encrypted)).not.toContain("hello harbor");
    await expect(decryptBytes(credentials, encrypted)).resolves.toEqual(original);
  });

  it("encrypts and decrypts stored secrets", async () => {
    const encrypted = await encryptSecretWithKey("hbr_secret", "workspace-secret");
    expect(encrypted).not.toContain("hbr_secret");
    await expect(decryptSecretWithKey(encrypted, "workspace-secret")).resolves.toBe(
      "hbr_secret",
    );
  });

  it("creates buckets and uploads files through Harbor", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ bucket_id: "bucket-1" }))
      .mockResolvedValueOnce(Response.json({ data: { id: "file-1" } }));

    await expect(createBucket(credentials, "Support@Example.com", fetchFn)).resolves.toBe(
      "bucket-1",
    );
    await expect(
      uploadFile(credentials, "bucket-1", new TextEncoder().encode("body"), "body.html", fetchFn),
    ).resolves.toBe("file-1");

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("downloads and decrypts files through Harbor", async () => {
    const encrypted = await encryptBytes(credentials, new TextEncoder().encode("stored"));
    const fetchFn = vi.fn(async () => new Response(encrypted));

    await expect(downloadFile(credentials, "bucket-1", "file-1", fetchFn)).resolves.toEqual(
      new TextEncoder().encode("stored"),
    );
  });

  it("creates a Harbor browser session and API key", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ session: "session-1" }), {
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ apiKey: "hbr_created" }), {
          headers: { "content-type": "application/json" },
        }),
      );
    const createServiceKeypair = () =>
      ({
        getSecretKey: () => "suiprivkey-service",
        getPublicKey: () => ({ toSuiAddress: () => "0xservice" }),
      }) as never;

    await expect(
      createHarborSession({
        email: "owner@example.com",
        sessionHeaders: {
          "X-Sui-Address": "0xowner",
          "X-Sui-Nonce": "nonce",
          "X-Sui-Signature": "signature",
          "X-Sui-Timestamp": "1781238000000",
        },
        fetchFn,
      }),
    ).resolves.toBe("session-1");

    await expect(
      createHarborApiKeyWithSession({
        harborSession: "session-1",
        fetchFn,
        createServiceKeypair,
      }),
    ).resolves.toEqual({
      apiKey: "hbr_created",
      servicePrivateKey: "suiprivkey-service",
      serviceSignerAddress: "0xservice",
    });
  });
});
