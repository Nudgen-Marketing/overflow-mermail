import { describe, expect, it, vi } from "vitest";

import { getEnokiJwt } from "../app/lib/server/enoki";
import {
  RAG_NAMESPACE,
  chunkDocumentText,
  formatChunkForMemory,
  recallRag,
  rememberRagChunks,
} from "../app/lib/server/rag/memwal";

describe("MemWal RAG helpers", () => {
  it("extracts Enoki JWTs from supported request locations", () => {
    expect(getEnokiJwt(new Headers({ "x-enoki-jwt": "jwt-1" }))).toBe("jwt-1");
    expect(getEnokiJwt(new Headers({ authorization: "Bearer jwt-2" }))).toBe(
      "jwt-2",
    );
    expect(
      getEnokiJwt(new Headers({ cookie: "clone_mail_enoki_jwt=jwt-3" })),
    ).toBe("jwt-3");
  });

  it("chunks documents with heading metadata", () => {
    const chunks = chunkDocumentText("# Shipping\nA".repeat(120), {
      filename: "FAQ.md",
      targetChars: 80,
      overlapChars: 10,
      maxChunks: 3,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].heading).toBe("Shipping");
  });

  it("formats chunks for MemWal memory", () => {
    expect(
      formatChunkForMemory({
        filename: "FAQ.md",
        ownerAddress: "0xabc",
        documentId: "doc-1",
        chunk: { index: 0, heading: "Shipping", text: "Ships in two days." },
      }),
    ).toContain("Document ID: doc-1");
  });

  it("remembers chunks and destroys the MemWal client", async () => {
    const destroy = vi.fn();
    const rememberBulkAndWait = vi.fn(async () => ({ ok: true }));
    await rememberRagChunks({
      delegateKey: "delegate",
      accountId: "0xaccount",
      chunks: ["a", "b"],
      createClient: () =>
        ({
          rememberBulkAndWait,
          recall: vi.fn(),
          destroy,
        }) as never,
    });

    expect(rememberBulkAndWait).toHaveBeenCalledWith(
      [
        { text: "a", namespace: RAG_NAMESPACE },
        { text: "b", namespace: RAG_NAMESPACE },
      ],
      { pollIntervalMs: 1_500, timeoutMs: 120_000 },
    );
    expect(destroy).toHaveBeenCalled();
  });

  it("recalls snippets from MemWal", async () => {
    await expect(
      recallRag({
        delegateKey: "delegate",
        accountId: "0xaccount",
        query: "shipping",
        createClient: () =>
          ({
            rememberBulkAndWait: vi.fn(),
            recall: vi.fn(async () => ({
              results: [
                { text: "Ships in two days.", blob_id: "blob-1", distance: 0.12 },
              ],
            })),
            destroy: vi.fn(),
          }) as never,
      }),
    ).resolves.toEqual([
      { text: "Ships in two days.", blobId: "blob-1", distance: 0.12 },
    ]);
  });
});
