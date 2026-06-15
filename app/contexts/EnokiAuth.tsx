"use client";

import { EnokiFlowProvider, useAuthCallback, useEnokiFlow, useZkLogin, useZkLoginSession } from "@mysten/enoki/react";
import { jwtDecode } from "jwt-decode";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  enokiClientConfig,
  getEnokiRedirectUrl,
  isEnokiClientConfigured,
} from "~/lib/enoki/config";

interface JwtProfile {
  email?: string;
  picture?: string;
  name?: string;
  exp?: number;
}

interface EnokiAuthContextValue {
  isConnected: boolean;
  isConfigured: boolean;
  address?: string;
  jwt?: string;
  emailAddress: string | null;
  displayName: string;
  avatarUrl: string | null;
  redirectToAuthUrl: () => Promise<void>;
  logout: () => Promise<void>;
}

const EnokiAuthContext = createContext<EnokiAuthContextValue | null>(null);

const SESSION_PROFILE_KEY = "clone-mail.enoki.profile";
const ENOKI_JWT_COOKIE_NAME = "clone_mail_enoki_jwt";

function isJwtExpired(jwt: string) {
  try {
    const { exp } = jwtDecode<JwtProfile>(jwt);
    return typeof exp === "number" && exp <= Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

function getCookieValue(name: string) {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));
  if (!cookie) return null;
  const value = cookie.slice(name.length + 1);
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function getSavedJwt() {
  const jwt = getCookieValue(ENOKI_JWT_COOKIE_NAME);
  if (!jwt) return null;
  if (!isJwtExpired(jwt)) return jwt;
  deleteCookie(ENOKI_JWT_COOKIE_NAME);
  return null;
}

function getJwtProfile(jwt?: string): JwtProfile | null {
  if (!jwt) return null;
  try {
    return jwtDecode<JwtProfile>(jwt);
  } catch {
    return null;
  }
}

function saveJwtCookie(jwt: string) {
  if (typeof document === "undefined") return;
  const profile = getJwtProfile(jwt);
  const maxAge =
    typeof profile?.exp === "number"
      ? Math.max(0, profile.exp - Math.floor(Date.now() / 1000))
      : 60 * 60 * 24;
  if (maxAge === 0) {
    deleteCookie(ENOKI_JWT_COOKIE_NAME);
    return;
  }
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ENOKI_JWT_COOKIE_NAME}=${encodeURIComponent(jwt)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export function shortenAddress(address?: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getNameFromEmail(email?: string | null) {
  if (!email) return "";
  const localPart = email.split("@")[0]?.split("+")[0];
  if (!localPart) return "";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function GoogleMark() {
  return (
    <svg
      aria-hidden="true"
      className="google-mark"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
        fill="#EA4335"
      />
    </svg>
  );
}

function SignInScreen() {
  const { redirectToAuthUrl, isConfigured } = useEnokiAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="app-shell">
      <section className="hero-panel sign-in-panel">
        <div className="status-strip">
          <span className="pulse" />
          zkLogin gateway
        </div>
        <div className="sign-in-grid">
          <div>
            <p className="eyebrow">Clone Mail</p>
            <h1>Sign in with Google, hold a Sui address.</h1>
          </div>
          <div className="auth-card">
            <button
              type="button"
              className="primary-action"
              disabled={!isConfigured || isRedirecting}
              onClick={async () => {
                setError(null);
                setIsRedirecting(true);
                try {
                  await redirectToAuthUrl();
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Unable to start Enoki sign-in.",
                  );
                  setIsRedirecting(false);
                }
              }}
            >
              <GoogleMark />
              {isRedirecting ? "Opening Google" : "Sign in with Google"}
            </button>
            {!isConfigured && (
              <p className="form-note error-text">
                Set NEXT_PUBLIC_ENOKI_API_KEY and NEXT_PUBLIC_GOOGLE_CLIENT_ID.
              </p>
            )}
            {error && <p className="form-note error-text">{error}</p>}
          </div>
        </div>
      </section>
    </main>
  );
}

export function EnokiAuthProvider({ children }: { children: React.ReactNode }) {
  const enokiFlow = useEnokiFlow();
  const { address } = useZkLogin();
  const zkLoginSession = useZkLoginSession();
  const [savedJwt, setSavedJwt] = useState<string | null>(() => getSavedJwt());
  const [profile, setProfile] = useState<JwtProfile | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = window.sessionStorage.getItem(SESSION_PROFILE_KEY);
    if (!saved) return getJwtProfile(getSavedJwt() ?? undefined);
    try {
      const parsed = JSON.parse(saved) as JwtProfile;
      return parsed?.email ? parsed : null;
    } catch {
      return getJwtProfile(getSavedJwt() ?? undefined);
    }
  });

  const sessionJwt = zkLoginSession?.jwt;
  const jwt = sessionJwt || savedJwt || undefined;
  const isConnected = Boolean(address && jwt);
  const emailAddress = profile?.email || null;
  const displayName =
    profile?.name?.trim() ||
    getNameFromEmail(emailAddress) ||
    shortenAddress(address) ||
    "Signed in";
  const avatarUrl = profile?.picture || null;

  useLayoutEffect(() => {
    if (!jwt) return;
    saveJwtCookie(jwt);
  }, [jwt]);

  useEffect(() => {
    if (!sessionJwt) return;
    saveJwtCookie(sessionJwt);
    setSavedJwt(sessionJwt);
  }, [sessionJwt]);

  useEffect(() => {
    const nextProfile = getJwtProfile(jwt);
    if (!nextProfile?.email) return;
    setProfile(nextProfile);
    sessionStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify(nextProfile));
  }, [jwt]);

  const logout = useCallback(async () => {
    await enokiFlow.logout();
    deleteCookie(ENOKI_JWT_COOKIE_NAME);
    setSavedJwt(null);
    sessionStorage.removeItem(SESSION_PROFILE_KEY);
    setProfile(null);
  }, [enokiFlow]);

  const redirectToAuthUrl = useCallback(async () => {
    if (!isEnokiClientConfigured()) {
      throw new Error("Enoki public API key and Google client ID are required.");
    }
    const url = await enokiFlow.createAuthorizationURL({
      provider: "google",
      network: enokiClientConfig.network,
      clientId: enokiClientConfig.googleClientId,
      redirectUrl: getEnokiRedirectUrl(),
      extraParams: {
        scope: ["openid", "email", "profile"],
      },
    });
    window.location.assign(url);
  }, [enokiFlow]);

  const value = useMemo<EnokiAuthContextValue>(
    () => ({
      isConnected,
      isConfigured: isEnokiClientConfigured(),
      address,
      jwt,
      emailAddress,
      displayName,
      avatarUrl,
      redirectToAuthUrl,
      logout,
    }),
    [
      address,
      avatarUrl,
      displayName,
      emailAddress,
      isConnected,
      jwt,
      logout,
      redirectToAuthUrl,
    ],
  );

  return (
    <EnokiAuthContext.Provider value={value}>
      {children}
    </EnokiAuthContext.Provider>
  );
}

export function EnokiProvider({ children }: { children: React.ReactNode }) {
  return (
    <EnokiFlowProvider apiKey={enokiClientConfig.enokiApiKey}>
      <EnokiAuthProvider>{children}</EnokiAuthProvider>
    </EnokiFlowProvider>
  );
}

export function EnokiAuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { address, jwt } = useEnokiAuth();

  if (pathname === "/auth") return <>{children}</>;

  if (address && !jwt) {
    return (
      <div className="loading-screen">
        <span className="pulse" />
      </div>
    );
  }

  if (!jwt) return <SignInScreen />;

  return <>{children}</>;
}

export function EnokiAuthCallbackRoute() {
  const router = useRouter();
  const { handled } = useAuthCallback();

  useEffect(() => {
    if (handled) router.replace("/");
  }, [handled, router]);

  return (
    <main className="app-shell">
      <section className="hero-panel callback-panel">
        <div className="status-strip">
          <span className="pulse" />
          completing sign-in
        </div>
      </section>
    </main>
  );
}

export function useEnokiAuth() {
  const context = useContext(EnokiAuthContext);
  if (!context) {
    throw new Error("useEnokiAuth must be used within EnokiAuthProvider.");
  }
  return context;
}
