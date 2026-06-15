import { NextResponse, type NextRequest } from "next/server";
import { createSentEmail } from "~/lib/server/mail/mail-service";

export async function POST(req: NextRequest) {
  try {
    const result = await createSentEmail(await req.json());
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Send email failed" },
      { status: 400 },
    );
  }
}
