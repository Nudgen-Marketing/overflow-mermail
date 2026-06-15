import { NextResponse, type NextRequest } from "next/server";
import {
  OpenAICompatibleConfigurationError,
  draftAssist,
  parseDraftAssistBody,
} from "~/lib/server/llm/openai-compatible";
import { getServerEnv } from "~/lib/server/env";

export async function POST(req: NextRequest) {
  try {
    const body = parseDraftAssistBody(await req.json());
    const draft = await draftAssist(getServerEnv(), body);
    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof OpenAICompatibleConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Draft assist failed" },
      { status: 400 },
    );
  }
}
