import { describe, expect, it, vi } from "vitest";

import {
  MAIL_AGENT_SYSTEM_PROMPT,
  MailAgentRequestSchema,
  runMailAgent,
  runRagMailAgent,
} from "../app/lib/server/agent/mail-agent";

describe("mail agent", () => {
  const env = {
    OPENAI_API_KEY: "test-key",
    OPENAI_AGENT_MODEL: "agent-model",
  };

  it("validates agent prompts", () => {
    expect(MailAgentRequestSchema.parse({ prompt: "Help answer this" })).toEqual({
      prompt: "Help answer this",
    });
    expect(() => MailAgentRequestSchema.parse({ prompt: "" })).toThrow();
  });

  it("runs the conversation with the dedicated model", async () => {
    const runner = vi.fn(async () => ({ text: "Hello customer", toolCalls: [] }));

    await expect(
      runMailAgent(
        env,
        {
          prompt: "Reply now",
          history: [{ role: "user", content: "My order is late" }],
        },
        runner,
      ),
    ).resolves.toEqual({
      text: "Hello customer",
      toolCalls: [],
      model: "agent-model",
    });

    expect(runner).toHaveBeenCalledWith(
      expect.objectContaining({ OPENAI_MODEL: "agent-model" }),
      expect.objectContaining({
        system: MAIL_AGENT_SYSTEM_PROMPT,
        messages: [
          { role: "user", content: "My order is late" },
          { role: "user", content: "Reply now" },
        ],
      }),
    );
  });

  it("injects recalled knowledge into the agent request", async () => {
    const runner = vi.fn(async () => ({ text: "Refunds take three days.", toolCalls: [] }));
    const loadContext = vi.fn(async () => ({
      attached: true,
      snippets: [
        { text: "Refunds take three days.", blobId: "blob-1", distance: 0.1 },
      ],
      text: "User Knowledge Base Context:\nRefunds take three days.",
    }));

    const result = await runRagMailAgent(
      env,
      "0xabc",
      { prompt: "How long do refunds take?" },
      { loadContext, runner },
    );

    expect(loadContext).toHaveBeenCalledWith(
      "0xabc",
      "How long do refunds take?",
    );
    expect(runner).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        messages: [
          {
            role: "user",
            content: expect.stringContaining("User Knowledge Base Context"),
          },
        ],
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ ragAttached: true, ragSources: ["blob-1"] }),
    );
  });

  it("continues with the base agent when MemWal is unavailable", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const runner = vi.fn(async () => ({ text: "Fallback answer", toolCalls: [] }));

    const result = await runRagMailAgent(
      env,
      "0xabc",
      { prompt: "Help" },
      {
        loadContext: vi.fn(async () => {
          throw new Error("MemWal timeout");
        }),
        runner,
      },
    );

    expect(result.ragAttached).toBe(false);
    expect(result.ragSources).toEqual([]);
    expect(result.text).toBe("Fallback answer");
    warn.mockRestore();
  });
});
