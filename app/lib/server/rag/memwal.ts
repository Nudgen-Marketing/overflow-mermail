import { MemWal } from "@mysten-incubation/memwal";
import { z } from "zod";

export const RAG_NAMESPACE = "clone-mail-rag";
export const DEFAULT_MEMWAL_SERVER_URL = "https://relayer.memory.walrus.xyz";
export const MAX_RAG_TEXT_CHARS = 250_000;
export const MAX_RAG_FILENAME_CHARS = 180;
export const MAX_RAG_CHUNKS_PER_DOCUMENT = 80;
export const RAG_CHUNK_TARGET_CHARS = 1_800;
export const RAG_CHUNK_OVERLAP_CHARS = 220;

const SuiObjectIdSchema = z.string().regex(/^0x[0-9a-fA-F]+$/);

export const RagCredentialPrepareRequestSchema = z.object({
  ownerAddress: SuiObjectIdSchema,
  serverUrl: z.string().url().optional(),
});

export const RagCredentialCompleteRequestSchema = z.object({
  ownerAddress: SuiObjectIdSchema,
  accountId: SuiObjectIdSchema,
  delegatePublicKey: z.string().regex(/^[0-9a-fA-F]{64}$/),
});

export const RagDocumentRequestSchema = z.object({
  ownerAddress: SuiObjectIdSchema,
  filename: z.string().trim().min(1).max(MAX_RAG_FILENAME_CHARS),
  mimeType: z.enum([
    "text/plain",
    "text/markdown",
    "text/x-markdown",
    "application/pdf",
  ]),
  text: z.string().trim().min(1).max(MAX_RAG_TEXT_CHARS),
});

export const RagRecallRequestSchema = z.object({
  ownerAddress: SuiObjectIdSchema,
  query: z.string().trim().min(1).max(4_000),
  limit: z.number().int().min(1).max(10).optional(),
});

export interface RagDocumentChunk {
  index: number;
  heading: string;
  text: string;
}

export interface RagRecallSnippet {
  text: string;
  blobId: string;
  distance: number;
}

export function normalizeRagServerUrl(serverUrl?: string | null) {
  return serverUrl?.trim() || DEFAULT_MEMWAL_SERVER_URL;
}

export function chunkDocumentText(
  text: string,
  options: {
    filename: string;
    targetChars?: number;
    overlapChars?: number;
    maxChunks?: number;
  },
): RagDocumentChunk[] {
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  if (!cleaned) return [];

  const targetChars = options.targetChars ?? RAG_CHUNK_TARGET_CHARS;
  const overlapChars = Math.min(
    options.overlapChars ?? RAG_CHUNK_OVERLAP_CHARS,
    Math.floor(targetChars / 3),
  );
  const maxChunks = options.maxChunks ?? MAX_RAG_CHUNKS_PER_DOCUMENT;
  const chunks: RagDocumentChunk[] = [];
  const lines = cleaned.split("\n");
  let heading = options.filename;
  let buffer: string[] = [];
  let bufferLength = 0;

  const flush = () => {
    const body = buffer.join("\n").trim();
    if (!body) return;
    chunks.push({ index: chunks.length, heading, text: body });
    const overlap = body.slice(Math.max(0, body.length - overlapChars));
    buffer = overlap ? [overlap] : [];
    bufferLength = overlap.length;
  };

  for (const line of lines) {
    const markdownHeading = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    if (markdownHeading?.[1]) {
      heading = markdownHeading[1].trim().slice(0, 160);
    }

    const segments =
      line.length > targetChars
        ? line.match(new RegExp(`.{1,${targetChars}}`, "g")) ?? [line]
        : [line];

    for (const segment of segments) {
      const nextLength = segment.length + 1;
      if (bufferLength > 0 && bufferLength + nextLength > targetChars) {
        flush();
        if (chunks.length >= maxChunks) break;
      }
      buffer.push(segment);
      bufferLength += nextLength;
    }
    if (chunks.length >= maxChunks) break;
  }

  if (chunks.length < maxChunks) flush();
  return chunks.slice(0, maxChunks);
}

export function formatChunkForMemory(input: {
  filename: string;
  ownerAddress: string;
  documentId: string;
  chunk: RagDocumentChunk;
}) {
  return [
    `Document: ${input.filename}`,
    `Document ID: ${input.documentId}`,
    `Owner: ${input.ownerAddress}`,
    `Section: ${input.chunk.heading}`,
    `Chunk: ${input.chunk.index + 1}`,
    "",
    input.chunk.text,
  ].join("\n");
}

export interface MemWalClientLike {
  rememberBulkAndWait(
    memories: Array<{ text: string; namespace: string }>,
    options: { pollIntervalMs: number; timeoutMs: number },
  ): Promise<unknown>;
  recall(input: {
    query: string;
    limit: number;
    namespace: string;
  }): Promise<{ results: Array<{ text: string; blob_id: string; distance: number }> }>;
  destroy(): void;
}

export function createMemWalClient(input: {
  delegateKey: string;
  accountId: string;
  serverUrl?: string;
}): MemWalClientLike {
  return MemWal.create({
    key: input.delegateKey,
    accountId: input.accountId,
    serverUrl: normalizeRagServerUrl(input.serverUrl),
    namespace: RAG_NAMESPACE,
  });
}

export async function rememberRagChunks(input: {
  delegateKey: string;
  accountId: string;
  serverUrl?: string;
  chunks: string[];
  createClient?: typeof createMemWalClient;
}) {
  const client = (input.createClient ?? createMemWalClient)(input);
  try {
    const batches: unknown[] = [];
    for (let index = 0; index < input.chunks.length; index += 20) {
      const batch = input.chunks.slice(index, index + 20);
      batches.push(
        await client.rememberBulkAndWait(
          batch.map((text) => ({ text, namespace: RAG_NAMESPACE })),
          { pollIntervalMs: 1_500, timeoutMs: 120_000 },
        ),
      );
    }
    return batches;
  } finally {
    client.destroy();
  }
}

export async function recallRag(input: {
  delegateKey: string;
  accountId: string;
  serverUrl?: string;
  query: string;
  limit?: number;
  createClient?: typeof createMemWalClient;
}): Promise<RagRecallSnippet[]> {
  const client = (input.createClient ?? createMemWalClient)(input);
  try {
    const recalled = await client.recall({
      query: input.query,
      limit: input.limit ?? 5,
      namespace: RAG_NAMESPACE,
    });
    return recalled.results.map((result) => ({
      text: result.text,
      blobId: result.blob_id,
      distance: result.distance,
    }));
  } finally {
    client.destroy();
  }
}
