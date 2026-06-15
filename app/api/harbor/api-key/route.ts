import { NextResponse, type NextRequest } from "next/server";
import {
  CreateHarborApiKeyBody,
  createHarborApiKeyWithSession,
} from "~/lib/server/harbor/api-key";

export async function POST(req: NextRequest) {
  try {
    const body = CreateHarborApiKeyBody.parse(await req.json());
    const credentials = await createHarborApiKeyWithSession(body);
    return NextResponse.json(credentials);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Harbor API key failed" },
      { status: 400 },
    );
  }
}
