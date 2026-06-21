import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "~/lib/server/env";
import {
  MailAgentRequestSchema,
  runMailAgent,
} from "~/lib/server/agent/mail-agent";
import { OpenAICompatibleConfigurationError } from "~/lib/server/llm/openai-compatible";

export async function POST(req: NextRequest) {
  try {
    const input = MailAgentRequestSchema.parse(await req.json());
    return NextResponse.json(await runMailAgent(getServerEnv(), input));
  } catch (error) {
    if (error instanceof OpenAICompatibleConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Agent request failed" },
      { status: 400 },
    );
  }
}
