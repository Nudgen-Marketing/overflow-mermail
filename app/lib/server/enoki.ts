import { EnokiClient } from "@mysten/enoki";
import type { ServerEnv } from "~/lib/server/env";

export const ENOKI_JWT_COOKIE_NAME = "clone_mail_enoki_jwt";

export function getEnokiJwt(headers: Headers) {
  const explicit = headers.get("x-enoki-jwt");
  if (explicit?.trim()) return explicit.trim();

  const authorization = headers.get("authorization");
  if (authorization) {
    const [scheme, token] = authorization.split(/\s+/, 2);
    if (scheme?.toLowerCase() === "bearer" && token?.trim()) return token.trim();
  }

  const cookie = headers.get("cookie");
  if (!cookie) return null;
  for (const entry of cookie.split(";")) {
    const [name, ...value] = entry.trim().split("=");
    if (name === ENOKI_JWT_COOKIE_NAME) {
      return decodeURIComponent(value.join("="));
    }
  }
  return null;
}

export function getEnokiZkLoginClient(env: Pick<ServerEnv, "NEXT_PUBLIC_ENOKI_API_KEY">) {
  if (!env.NEXT_PUBLIC_ENOKI_API_KEY) {
    throw new Error("NEXT_PUBLIC_ENOKI_API_KEY is not configured.");
  }
  return new EnokiClient({ apiKey: env.NEXT_PUBLIC_ENOKI_API_KEY });
}
