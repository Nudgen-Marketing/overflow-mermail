export default function Page() {
  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="status-strip">
          <span className="pulse" />
          zkLogin submission build
        </div>
        <div className="hero-grid">
          <div>
            <p className="eyebrow">Clone Mail</p>
            <h1>OAuth identity, proven by zkLogin.</h1>
          </div>
          <div className="console-card" aria-label="Authentication status preview">
            <div className="console-line">
              <span>provider</span>
              <strong>Google</strong>
            </div>
            <div className="console-line">
              <span>network</span>
              <strong>testnet</strong>
            </div>
            <div className="console-line">
              <span>session</span>
              <strong>pending</strong>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
