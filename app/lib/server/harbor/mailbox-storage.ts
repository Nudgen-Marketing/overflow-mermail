import { prisma } from "~/lib/prisma";
import { getServerEnv } from "~/lib/server/env";
import {
  createBucket,
  downloadFile,
  type HarborCredentials,
  isHarborConfigured,
  uploadFile,
} from "~/lib/server/harbor/client";
import { decryptSecretWithKey, encryptSecretWithKey } from "~/lib/server/secret-box";

interface StoreHarborCredentialsInput {
  mailboxId: string;
  spaceId: string;
  apiKey: string;
  servicePrivateKey: string;
  ownerAddress?: string;
}

async function getSecretKey() {
  const key = getServerEnv().WORKSPACE_SECRET_KEY;
  if (!key) throw new Error("WORKSPACE_SECRET_KEY is not configured.");
  return key;
}

export async function storeHarborCredentials(input: StoreHarborCredentialsInput) {
  const secretKey = await getSecretKey();
  return prisma.workspaceStorage.upsert({
    where: { mailboxId: input.mailboxId },
    create: {
      mailboxId: input.mailboxId,
      status: "pending",
      harborSpaceId: input.spaceId,
      harborOwnerAddress: input.ownerAddress,
      harborApiKeyCiphertext: await encryptSecretWithKey(input.apiKey, secretKey),
      harborServiceKeyCiphertext: await encryptSecretWithKey(
        input.servicePrivateKey,
        secretKey,
      ),
    },
    update: {
      status: "pending",
      harborSpaceId: input.spaceId,
      harborOwnerAddress: input.ownerAddress,
      harborApiKeyCiphertext: await encryptSecretWithKey(input.apiKey, secretKey),
      harborServiceKeyCiphertext: await encryptSecretWithKey(
        input.servicePrivateKey,
        secretKey,
      ),
      lastError: null,
    },
  });
}

export async function getMailboxHarborCredentials(mailboxId: string) {
  const storage = await prisma.workspaceStorage.findUnique({
    where: { mailboxId },
  });
  if (!storage?.harborApiKeyCiphertext || !storage.harborServiceKeyCiphertext) {
    return null;
  }
  const secretKey = await getSecretKey();
  return {
    bucketId: storage.harborBucketId,
    credentials: {
      apiKey: await decryptSecretWithKey(storage.harborApiKeyCiphertext, secretKey),
      spaceId: storage.harborSpaceId ?? undefined,
      privateKey: await decryptSecretWithKey(
        storage.harborServiceKeyCiphertext,
        secretKey,
      ),
    } satisfies HarborCredentials,
  };
}

export async function ensureMailboxBucket(mailboxId: string) {
  const record = await getMailboxHarborCredentials(mailboxId);
  if (!record) return null;
  if (record.bucketId) return { bucketId: record.bucketId, credentials: record.credentials };
  if (!isHarborConfigured(record.credentials)) return null;

  const bucketId = await createBucket(record.credentials, `mailbox-${mailboxId}`);
  await prisma.workspaceStorage.update({
    where: { mailboxId },
    data: { harborBucketId: bucketId, status: "active", lastError: null },
  });
  return { bucketId, credentials: record.credentials };
}

export async function uploadMailboxFile(
  mailboxId: string,
  bytes: Uint8Array,
  filename: string,
) {
  const bucket = await ensureMailboxBucket(mailboxId);
  if (!bucket) return null;
  return uploadFile(bucket.credentials, bucket.bucketId, bytes, filename);
}

export async function downloadMailboxFile(mailboxId: string, fileId: string) {
  const bucket = await ensureMailboxBucket(mailboxId);
  if (!bucket) return null;
  return downloadFile(bucket.credentials, bucket.bucketId, fileId);
}
