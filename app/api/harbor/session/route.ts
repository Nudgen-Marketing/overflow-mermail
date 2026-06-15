import { NextResponse, type NextRequest } from "next/server";
import {
  CreateHarborSessionBody,
  createHarborSession,
} from "~/lib/server/harbor/api-key";

export async function POST(req: NextRequest) {
  try {
    const body = CreateHarborSessionBody.parse(await req.json());
    const harborSession = await createHarborSession(body);
    return NextResponse.json({ harborSession });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Harbor session failed" },
      { status: 400 },
    );
  }
}
