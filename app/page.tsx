"use client";

import { enokiClientConfig } from "~/lib/enoki/config";
import { shortenAddress, useEnokiAuth } from "~/contexts/EnokiAuth";

export default function Page() {
  const {
    address,
    avatarUrl,
    displayName,
    emailAddress,
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
      </section>
    </main>
  );
}
