"use client";

import { enokiClientConfig } from "~/lib/enoki/config";
import { shortenAddress, useEnokiAuth } from "~/contexts/EnokiAuth";
import type { SignedSessionHeaders } from "~/lib/session/signing";
import { useState } from "react";
import { FeaturePanels } from "~/components/FeaturePanels";

export default function Page() {
  const [headers, setHeaders] = useState<SignedSessionHeaders | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const {
    address,
    avatarUrl,
    displayName,
    emailAddress,
    generateSignedSessionHeaders,
    isConnected,
    jwt,
    logout,
  } = useEnokiAuth();

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="status-strip">
          <span className="pulse" />
          authenticated
        </div>
        <div className="hero-grid">
          <div>
            <p className="eyebrow">Clone Mail</p>
            <h1>OAuth identity, proven by zkLogin.</h1>
            <div className="account-row">
              <div className="avatar" aria-hidden="true">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <span>{displayName.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div>
                <strong>{displayName}</strong>
                <span>{emailAddress || shortenAddress(address)}</span>
              </div>
            </div>
          </div>
          <div className="console-card" aria-label="Authentication status preview">
            <div className="console-line">
              <span>provider</span>
              <strong>Google</strong>
            </div>
            <div className="console-line">
              <span>network</span>
              <strong>{enokiClientConfig.network}</strong>
            </div>
            <div className="console-line">
              <span>session</span>
              <strong>{isConnected ? "active" : "pending"}</strong>
            </div>
            <div className="console-line">
              <span>sui address</span>
              <strong>{shortenAddress(address)}</strong>
            </div>
            <div className="console-line">
              <span>jwt</span>
              <strong>{jwt ? "stored" : "missing"}</strong>
            </div>
            <button className="secondary-action" type="button" onClick={() => void logout()}>
              Sign out
            </button>
          </div>
        </div>
        <div className="session-panel">
          <div>
            <p className="eyebrow">Signed session</p>
            <h2>Personal-message proof</h2>
          </div>
          <div className="session-actions">
            <button
              className="primary-action"
              type="button"
              disabled={isSigning}
              onClick={async () => {
                setSessionError(null);
                setIsSigning(true);
                try {
                  setHeaders(await generateSignedSessionHeaders());
                } catch (err) {
                  setSessionError(
                    err instanceof Error
                      ? err.message
                      : "Unable to generate signed session.",
                  );
                } finally {
                  setIsSigning(false);
                }
              }}
            >
              {isSigning ? "Signing session" : "Generate headers"}
            </button>
          </div>
          {sessionError && <p className="form-note error-text">{sessionError}</p>}
          {headers && (
            <dl className="headers-grid">
              {Object.entries(headers).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <FeaturePanels />
      </section>
    </main>
  );
}
