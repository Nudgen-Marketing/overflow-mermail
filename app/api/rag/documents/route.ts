import { NextResponse, type NextRequest } from "next/server";
import { indexRagDocument } from "~/lib/server/rag/rag-service";

export async function POST(req: NextRequest) {
  try {
    return NextResponse.json(await indexRagDocument(req.headers, await req.json()));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "RAG indexing failed" },
      { status: 400 },
    );
  }
}
