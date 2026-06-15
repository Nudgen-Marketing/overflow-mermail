const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

function fromBase64(value: string) {
  return new Uint8Array(Buffer.from(value, "base64"));
}

async function importSecretKey(secret: string) {
  const material = encoder.encode(secret);
  const hash = await crypto.subtle.digest("SHA-256", material);
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptSecretWithKey(value: string, secret: string) {
  if (!secret.trim()) throw new Error("Secret key is required.");
  const key = await importSecretKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(value)),
  );
  return `${toBase64(iv)}.${toBase64(ciphertext)}`;
}

export async function decryptSecretWithKey(value: string, secret: string) {
  if (!secret.trim()) throw new Error("Secret key is required.");
  const [ivValue, ciphertextValue] = value.split(".");
  if (!ivValue || !ciphertextValue) throw new Error("Invalid encrypted secret.");
  const key = await importSecretKey(secret);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(ivValue) },
    key,
    fromBase64(ciphertextValue),
  );
  return decoder.decode(plaintext);
}
