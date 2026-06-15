const HARBOR_BASE_URL = "https://api.testnet.harbor.walrus.xyz";

export interface HarborCredentials {
  apiKey?: string;
  spaceId?: string;
  privateKey?: string;
}

export function isHarborConfigured(credentials: HarborCredentials) {
  return Boolean(
    credentials.apiKey?.trim() &&
      credentials.spaceId?.trim() &&
      credentials.privateKey?.trim(),
  );
}

function authHeaders(credentials: HarborCredentials) {
  return { Authorization: `Bearer ${credentials.apiKey}` };
}

function jsonHeaders(credentials: HarborCredentials) {
  return { ...authHeaders(credentials), "Content-Type": "application/json" };
}

function toBucketName(value: string) {
  return value
    .toLowerCase()
    .replace(/@/g, "-at-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63);
}

async function deriveAesKey(credentials: HarborCredentials) {
  const material = new TextEncoder().encode(credentials.privateKey);
  const hash = await crypto.subtle.digest("SHA-256", material);
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

function toPlainArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

export async function encryptBytes(
  credentials: HarborCredentials,
  bytes: Uint8Array,
) {
  const key = await deriveAesKey(credentials);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, toPlainArrayBuffer(bytes)),
  );
  const out = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  out.set(iv);
  out.set(ciphertext, iv.byteLength);
  return out;
}

export async function decryptBytes(
  credentials: HarborCredentials,
  bytes: Uint8Array,
) {
  const key = await deriveAesKey(credentials);
  return new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.slice(0, 12) },
      key,
      toPlainArrayBuffer(bytes.slice(12)),
    ),
  );
}

export async function createBucket(
  credentials: HarborCredentials,
  bucketName: string,
  fetchFn: typeof fetch = fetch,
) {
  const response = await fetchFn(
    `${HARBOR_BASE_URL}/api/v1/spaces/${credentials.spaceId}/buckets`,
    {
      method: "POST",
      headers: jsonHeaders(credentials),
      body: JSON.stringify({
        name: toBucketName(bucketName),
        scope: "private",
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Harbor createBucket [${response.status}]: ${await response.text()}`);
  }
  const payload = (await response.json()) as { bucket_id: string; bytes?: string };
  return payload.bucket_id;
}

export async function uploadFile(
  credentials: HarborCredentials,
  bucketId: string,
  bytes: Uint8Array,
  filename: string,
  fetchFn: typeof fetch = fetch,
) {
  const ciphertext = await encryptBytes(credentials, bytes);
  const form = new FormData();
  form.append("file", new Blob([ciphertext]), filename);
  form.append("name", crypto.randomUUID());

  const response = await fetchFn(
    `${HARBOR_BASE_URL}/api/v1/buckets/${bucketId}/files`,
    {
      method: "POST",
      headers: authHeaders(credentials),
      body: form,
    },
  );
  if (!response.ok) {
    throw new Error(`Harbor uploadFile [${response.status}]: ${await response.text()}`);
  }
  const payload = (await response.json()) as { data: { id: string } };
  return payload.data.id;
}

export async function downloadFile(
  credentials: HarborCredentials,
  bucketId: string,
  fileId: string,
  fetchFn: typeof fetch = fetch,
) {
  const response = await fetchFn(
    `${HARBOR_BASE_URL}/api/v1/buckets/${bucketId}/files/${fileId}/download`,
    { headers: authHeaders(credentials) },
  );
  if (!response.ok) {
    throw new Error(`Harbor downloadFile [${response.status}]: ${await response.text()}`);
  }
  return decryptBytes(credentials, new Uint8Array(await response.arrayBuffer()));
}

export function isHarborDownloadDeletedError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    /Harbor downloadFile \[(404|410|423)\]/.test(message) &&
    /being deleted|deleted|not found|cannot be downloaded/i.test(message)
  );
}
