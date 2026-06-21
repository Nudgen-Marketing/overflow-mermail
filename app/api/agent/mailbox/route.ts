import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "~/lib/server/env";
import {
  MailAgentRequestSchema,
  runRagMailAgent,
} from "~/lib/server/agent/mail-agent";
import { OpenAICompatibleConfigurationError } from "~/lib/server/llm/openai-compatible";
import { getEnokiJwt, getEnokiZkLoginClient } from "~/lib/server/enoki";

class AgentAuthenticationError extends Error {}

async function requireAgentAddress(headers: Headers) {
  const jwt = getEnokiJwt(headers);
  if (!jwt) throw new AgentAuthenticationError("Missing Enoki JWT");
  return (await getEnokiZkLoginClient(getServerEnv()).getZkLogin({ jwt })).address;
}

export async function POST(req: NextRequest) {
  try {
    const input = MailAgentRequestSchema.parse(await req.json());
    const env = getServerEnv();
    const ownerAddress = await requireAgentAddress(req.headers);
    return NextResponse.json(await runRagMailAgent(env, ownerAddress, input));
  } catch (error) {
    if (error instanceof AgentAuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof OpenAICompatibleConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Agent request failed" },
      { status: 400 },
    );
  }
}
