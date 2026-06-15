import { prisma } from "~/lib/prisma";
import { getServerEnv } from "~/lib/server/env";
import { getEnokiJwt, getEnokiZkLoginClient } from "~/lib/server/enoki";
import { decryptSecretWithKey, encryptSecretWithKey } from "~/lib/server/secret-box";
import {
  DEFAULT_MEMWAL_SERVER_URL,
  RagCredentialCompleteRequestSchema,
  RagCredentialPrepareRequestSchema,
  RagDocumentRequestSchema,
  RagRecallRequestSchema,
  chunkDocumentText,
  formatChunkForMemory,
  normalizeRagServerUrl,
  recallRag,
  rememberRagChunks,
} from "~/lib/server/rag/memwal";

function toHex(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("hex");
}

function getWorkspaceSecretKey() {
  const key = getServerEnv().WORKSPACE_SECRET_KEY;
  if (!key) throw new Error("WORKSPACE_SECRET_KEY is not configured.");
  return key;
}

async function requireRagOwner(headers: Headers, ownerAddress: string) {
  const jwt = getEnokiJwt(headers);
  if (!jwt) throw new Error("Missing Enoki JWT");
  const { address } = await getEnokiZkLoginClient(getServerEnv()).getZkLogin({
    jwt,
  });
  if (address.toLowerCase() !== ownerAddress.toLowerCase()) {
    throw new Error("RAG owner address does not match the Enoki session.");
  }
}

export async function prepareRagCredential(headers: Headers, body: unknown) {
  const parsed = RagCredentialPrepareRequestSchema.parse(body);
  await requireRagOwner(headers, parsed.ownerAddress);
  const { generateDelegateKey } = await import("@mysten-incubation/memwal/account");
  const delegate = await generateDelegateKey();
  const secretKey = getWorkspaceSecretKey();
  const credential = await prisma.ragCredential.upsert({
    where: { ownerAddress: parsed.ownerAddress },
    create: {
      ownerAddress: parsed.ownerAddress,
      delegateKeyCiphertext: await encryptSecretWithKey(delegate.privateKey, secretKey),
      delegatePublicKey: toHex(delegate.publicKey),
      delegateAddress: delegate.suiAddress,
      serverUrl: normalizeRagServerUrl(parsed.serverUrl),
      status: "pending",
    },
    update: {
      accountId: null,
      delegateKeyCiphertext: await encryptSecretWithKey(delegate.privateKey, secretKey),
      delegatePublicKey: toHex(delegate.publicKey),
      delegateAddress: delegate.suiAddress,
      serverUrl: normalizeRagServerUrl(parsed.serverUrl),
      status: "pending",
      lastError: null,
    },
  });
  return { credential: { ...credential, hasDelegateKey: true } };
}

export async function completeRagCredential(headers: Headers, body: unknown) {
  const parsed = RagCredentialCompleteRequestSchema.parse(body);
  await requireRagOwner(headers, parsed.ownerAddress);
  const existing = await prisma.ragCredential.findUnique({
    where: { ownerAddress: parsed.ownerAddress },
  });
  if (!existing) throw new Error("Prepare MemWal credentials first.");
  if (existing.delegatePublicKey.toLowerCase() !== parsed.delegatePublicKey.toLowerCase()) {
    throw new Error("MemWal delegate public key does not match.");
  }
  const credential = await prisma.ragCredential.update({
    where: { ownerAddress: parsed.ownerAddress },
    data: { accountId: parsed.accountId, status: "active", lastError: null },
  });
  return { credential: { ...credential, hasDelegateKey: true } };
}

async function getActiveCredential(headers: Headers, ownerAddress: string) {
  await requireRagOwner(headers, ownerAddress);
  const credential = await prisma.ragCredential.findUnique({
    where: { ownerAddress },
  });
  if (!credential?.accountId || credential.status !== "active") {
    throw new Error("MemWal credentials are not configured for this address.");
  }
  return {
    delegateKey: await decryptSecretWithKey(
      credential.delegateKeyCiphertext,
      getWorkspaceSecretKey(),
    ),
    accountId: credential.accountId,
    serverUrl: credential.serverUrl || DEFAULT_MEMWAL_SERVER_URL,
  };
}

export async function indexRagDocument(headers: Headers, body: unknown) {
  const parsed = RagDocumentRequestSchema.parse(body);
  const credential = await getActiveCredential(headers, parsed.ownerAddress);
  const documentId = crypto.randomUUID();
  const chunks = chunkDocumentText(parsed.text, { filename: parsed.filename });
  if (chunks.length === 0) throw new Error("Document text did not contain indexable content.");

  await rememberRagChunks({
    ...credential,
    chunks: chunks.map((chunk) =>
      formatChunkForMemory({
        filename: parsed.filename,
        ownerAddress: parsed.ownerAddress,
        documentId,
        chunk,
      }),
    ),
  });

  const document = await prisma.ragDocument.create({
    data: {
      documentId,
      ownerAddress: parsed.ownerAddress,
      filename: parsed.filename,
      mimeType: parsed.mimeType,
      chunkCount: chunks.length,
    },
  });
  return { document };
}

export async function recallRagSnippets(headers: Headers, body: unknown) {
  const parsed = RagRecallRequestSchema.parse(body);
  const credential = await getActiveCredential(headers, parsed.ownerAddress);
  const snippets = await recallRag({
    ...credential,
    query: parsed.query,
    limit: parsed.limit,
  });
  return {
    snippets: snippets.map((snippet) => ({
      ...snippet,
      text: snippet.text.slice(0, 4_000),
    })),
  };
}
