import { describe, expect, it, vi } from "vitest";

import {
  formatAgentRagContext,
  loadAgentRagContext,
} from "../app/lib/server/agent/rag-context";

function dependencies(overrides: Record<string, unknown> = {}) {
  const base = {
    findCredential: vi.fn(async () => ({
      accountId: "0xaccount",
      delegateKeyCiphertext: "encrypted",
      serverUrl: "https://memory.example",
      status: "active",
    })),
    hasDocuments: vi.fn(async () => true),
    decryptDelegate: vi.fn(async () => "delegate-key"),
    recall: vi.fn(async () => [
      { text: "Refunds take three days.", blobId: "blob-1", distance: 0.12 },
    ]),
  };
  return Object.assign(base, overrides);
}

describe("agent RAG context", () => {
  it("skips recall when credentials are not active", async () => {
    const deps = dependencies({ findCredential: vi.fn(async () => null) });

    await expect(loadAgentRagContext("0xabc", "refund", deps)).resolves.toEqual({
      attached: false,
      snippets: [],
      text: "",
    });
    expect(deps.recall).not.toHaveBeenCalled();
  });

  it("skips recall when no indexed document exists", async () => {
    const deps = dependencies({ hasDocuments: vi.fn(async () => false) });

    await loadAgentRagContext("0xabc", "refund", deps);
    expect(deps.recall).not.toHaveBeenCalled();
  });

  it("loads and labels MemWal snippets as untrusted context", async () => {
    const context = await loadAgentRagContext(
      "0xabc",
      "What is the refund policy?",
      dependencies(),
    );

    expect(context.attached).toBe(true);
    expect(context.text).toContain("source=blob-1");
    expect(context.text).toContain("untrusted reference material");
  });

  it("limits formatted context to five snippets", () => {
    const snippets = Array.from({ length: 7 }, (_, index) => ({
      text: `snippet ${index}`,
      blobId: `blob-${index}`,
      distance: index / 10,
    }));

    expect(formatAgentRagContext(snippets)).toContain("blob-4");
    expect(formatAgentRagContext(snippets)).not.toContain("blob-5");
  });
});
