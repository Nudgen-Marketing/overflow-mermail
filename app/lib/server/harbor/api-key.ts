import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { z } from "zod";

const HARBOR_API_BASE_URL = "https://api.testnet.harbor.walrus.xyz";
const HARBOR_WEB_ORIGIN = "https://testnet.harbor.walrus.xyz";

export const HarborSessionHeadersBody = z.object({
  "X-Sui-Address": z.string().trim().min(1),
  "X-Sui-Nonce": z.string().trim().min(1),
  "X-Sui-Signature": z.string().trim().min(1),
  "X-Sui-Timestamp": z.string().trim().min(1),
});

export const CreateHarborSessionBody = z.object({
  email: z.string().email(),
  sessionHeaders: HarborSessionHeadersBody,
});

export const CreateHarborApiKeyBody = z.object({
  harborSession: z.string().min(1),
  name: z.string().trim().min(1).max(120).optional(),
});

type HarborSessionHeaders = z.infer<typeof HarborSessionHeadersBody>;

function browserHeaders() {
  return {
    accept: "application/json, text/plain, */*",
    "content-type": "application/json",
    origin: HARBOR_WEB_ORIGIN,
    referer: `${HARBOR_WEB_ORIGIN}/`,
  };
}

function sessionAuthHeaders(headers: HarborSessionHeaders) {
  return {
    "x-sui-address": headers["X-Sui-Address"],
    "x-sui-nonce": headers["X-Sui-Nonce"],
    "x-sui-signature": headers["X-Sui-Signature"],
    "x-sui-timestamp": headers["X-Sui-Timestamp"],
  };
}

function parseJson(text: string) {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function findString(payload: unknown, names: Set<string>): string | null {
  if (!payload || typeof payload !== "object") return null;
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = findString(item, names);
      if (found) return found;
    }
    return null;
  }
  for (const [key, value] of Object.entries(payload)) {
    const normalized = key.replace(/[-_]/g, "").toLowerCase();
    if (typeof value === "string" && names.has(normalized)) return value;
    const nested = findString(value, names);
    if (nested) return nested;
  }
  return null;
}

export async function createHarborSession(input: {
  email: string;
  sessionHeaders: HarborSessionHeaders;
  fetchFn?: typeof fetch;
}) {
  const fetchFn = input.fetchFn ?? fetch;
  const response = await fetchFn(`${HARBOR_API_BASE_URL}/auth/session`, {
    method: "POST",
    headers: {
      ...browserHeaders(),
      ...sessionAuthHeaders(input.sessionHeaders),
    },
    body: JSON.stringify({ email: input.email }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Harbor create session [${response.status}]: ${text}`);
  }
  const cookie = response.headers.get("set-cookie")?.match(/harbor_session=([^;,\s]+)/)?.[1];
  return cookie ?? findString(parseJson(text), new Set(["harborsession", "session", "sessiontoken"]));
}

export async function createHarborApiKeyWithSession(input: {
  harborSession: string;
  name?: string;
  fetchFn?: typeof fetch;
  createServiceKeypair?: () => Ed25519Keypair;
}) {
  const fetchFn = input.fetchFn ?? fetch;
  const serviceKeypair = input.createServiceKeypair?.() ?? Ed25519Keypair.generate();
  const servicePrivateKey = serviceKeypair.getSecretKey();
  const serviceSignerAddress = serviceKeypair.getPublicKey().toSuiAddress();
  const response = await fetchFn(`${HARBOR_API_BASE_URL}/api/v1/api-keys`, {
    method: "POST",
    headers: {
      ...browserHeaders(),
      cookie: `harbor_session=${input.harborSession}`,
    },
    body: JSON.stringify({
      name: input.name || "Clone Mail workspace storage",
      permissions: "read_write",
      serviceSignerAddress,
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Harbor create API key [${response.status}]: ${text}`);
  }
  const apiKey = findString(parseJson(text), new Set(["apikey", "key", "secret", "token", "value"]));
  if (!apiKey) throw new Error("Harbor create API key response did not include an API key.");
  return { apiKey, servicePrivateKey, serviceSignerAddress };
}
