import type { EnokiNetwork } from "@mysten/enoki";

const DEFAULT_SUI_NETWORK: EnokiNetwork = "testnet";
const DEFAULT_SUI_FULLNODE_URL = "https://fullnode.testnet.sui.io:443";
const DEFAULT_ENOKI_REDIRECT_PATH = "/auth";

export function normalizeNetwork(value: string | undefined): EnokiNetwork {
  if (value === "mainnet" || value === "testnet" || value === "devnet") {
    return value;
  }
  return DEFAULT_SUI_NETWORK;
}

export const enokiClientConfig = {
  network: normalizeNetwork(process.env.NEXT_PUBLIC_SUI_NETWORK),
  fullnodeUrl:
    process.env.NEXT_PUBLIC_SUI_FULLNODE_URL || DEFAULT_SUI_FULLNODE_URL,
  enokiApiKey: process.env.NEXT_PUBLIC_ENOKI_API_KEY || "",
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
  redirectUrl: process.env.NEXT_PUBLIC_ENOKI_REDIRECT_URL || "",
};

export function resolveEnokiRedirectUrl(
  configuredRedirectUrl: string | undefined,
  origin: string,
) {
  const redirectUrl =
    configuredRedirectUrl?.trim() || DEFAULT_ENOKI_REDIRECT_PATH;
  return new URL(redirectUrl, origin).toString();
}

export function getEnokiRedirectUrl() {
  if (typeof window === "undefined") return DEFAULT_ENOKI_REDIRECT_PATH;
  return resolveEnokiRedirectUrl(
    enokiClientConfig.redirectUrl,
    window.location.origin,
  );
}

export function isEnokiClientConfigured() {
  return Boolean(
    enokiClientConfig.enokiApiKey && enokiClientConfig.googleClientId,
  );
}
