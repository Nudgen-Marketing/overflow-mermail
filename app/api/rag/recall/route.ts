import { NextResponse, type NextRequest } from "next/server";
import { recallRagSnippets } from "~/lib/server/rag/rag-service";

export async function POST(req: NextRequest) {
  try {
    return NextResponse.json(await recallRagSnippets(req.headers, await req.json()));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "RAG recall failed" },
      { status: 400 },
    );
  }
}
