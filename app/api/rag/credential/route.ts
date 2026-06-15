import { NextResponse, type NextRequest } from "next/server";
import {
  completeRagCredential,
  prepareRagCredential,
} from "~/lib/server/rag/rag-service";

export async function POST(req: NextRequest) {
  try {
    const action = req.nextUrl.searchParams.get("action") || "prepare";
    const body = await req.json();
    const result =
      action === "complete"
        ? await completeRagCredential(req.headers, body)
        : await prepareRagCredential(req.headers, body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "RAG credential failed" },
      { status: 400 },
    );
  }
}
