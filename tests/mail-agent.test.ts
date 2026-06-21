import { describe, expect, it, vi } from "vitest";

import {
  MAIL_AGENT_SYSTEM_PROMPT,
  MailAgentRequestSchema,
  runMailAgent,
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
});
