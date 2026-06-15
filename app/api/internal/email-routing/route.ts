import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "~/lib/server/env";
import { persistInboundEmail } from "~/lib/server/mail/mail-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const env = getServerEnv();
  if (!env.INTERNAL_EMAIL_SECRET) {
    return NextResponse.json(
      { error: "INTERNAL_EMAIL_SECRET is not configured." },
      { status: 500 },
    );
  }
  if (req.headers.get("x-internal-secret") !== env.INTERNAL_EMAIL_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await persistInboundEmail(await req.arrayBuffer());
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Inbound email failed" },
      { status: 500 },
    );
  }
}
