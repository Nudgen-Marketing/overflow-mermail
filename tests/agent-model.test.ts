import { describe, expect, it } from "vitest";

import {
  DEFAULT_AGENT_MODEL,
  getAgentModelConfig,
} from "../app/lib/server/agent/model";

describe("agent model configuration", () => {
  const env = {
    OPENAI_API_KEY: "test-key",
    OPENAI_BASE_URL: "https://llm.example/v1",
    OPENAI_MODEL: "draft-model",
  };

  it("uses the dedicated agent model by default", () => {
    expect(getAgentModelConfig(env)).toEqual({
      apiKey: "test-key",
      baseURL: "https://llm.example/v1",
      model: DEFAULT_AGENT_MODEL,
    });
  });

  it("accepts an agent-only model override", () => {
    expect(
      getAgentModelConfig({ ...env, OPENAI_AGENT_MODEL: "agent-model" }).model,
    ).toBe("agent-model");
  });
});
