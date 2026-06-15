import type { SignatureWithBytes } from "@mysten/sui/cryptography";

const SESSION_NONCE_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

type RandomValues = (values: Uint8Array) => Uint8Array;

interface SessionSigner {
  signPersonalMessage(bytes: Uint8Array): Promise<SignatureWithBytes>;
}

export interface SignedSessionHeaderInput {
  address: string;
  signer: SessionSigner;
  timestamp?: number | string;
  nonce?: string;
  nonceLength?: number;
  randomValues?: RandomValues;
}

export interface SignedSessionHeaders {
  "X-Sui-Address": string;
  "X-Sui-Nonce": string;
  "X-Sui-Signature": string;
  "X-Sui-Timestamp": string;
}

export function createSessionNonce(
  length = 32,
  randomValues: RandomValues = (values) => crypto.getRandomValues(values),
) {
  if (!Number.isInteger(length) || length < 1) {
    throw new Error("Nonce length must be a positive integer.");
  }

  const bytes = randomValues(new Uint8Array(length));
  return Array.from(
    bytes,
    (byte) => SESSION_NONCE_ALPHABET[byte % SESSION_NONCE_ALPHABET.length],
  ).join("");
}

export async function createSignedSessionHeaders({
  address,
  signer,
  timestamp = Date.now(),
  nonce,
  nonceLength,
  randomValues,
}: SignedSessionHeaderInput): Promise<SignedSessionHeaders> {
  if (!address) throw new Error("Sui address is required.");

  const timestampValue = timestamp.toString();
  const nonceValue = nonce ?? createSessionNonce(nonceLength, randomValues);
  const message = `create_session:${timestampValue}:${nonceValue}`;
  const { signature } = await signer.signPersonalMessage(
    new TextEncoder().encode(message),
  );

  return {
    "X-Sui-Address": address,
    "X-Sui-Nonce": nonceValue,
    "X-Sui-Signature": signature,
    "X-Sui-Timestamp": timestampValue,
  };
}
