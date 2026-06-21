import type { ServerEnv } from "~/lib/server/env";
import { getOpenAICompatibleConfig } from "~/lib/server/llm/openai-compatible";

export const DEFAULT_AGENT_MODEL = "gpt-4.1";

export function getAgentModelConfig(env: ServerEnv) {
  const base = getOpenAICompatibleConfig(env);

  return {
    ...base,
    model: env.OPENAI_AGENT_MODEL?.trim() || DEFAULT_AGENT_MODEL,
  };
}
