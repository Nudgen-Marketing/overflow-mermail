interface FeaturePanel {
  title: string;
  label: string;
  status: "ready" | "needs env" | "demo";
  body: string;
  details: string[];
}

const panels: FeaturePanel[] = [
  {
    title: "OpenAI-compatible LLM",
    label: "AI",
    status: "needs env",
    body: "Generic OpenAI client surface for draft assist, prompt checks, and tool loops.",
    details: ["OPENAI_API_KEY", "OPENAI_BASE_URL", "OPENAI_MODEL"],
  },
  {
    title: "Cloudflare Email",
    label: "Mail",
    status: "needs env",
    body: "Inbound Email Routing worker plus outbound Email Sending REST adapter.",
    details: ["INTERNAL_EMAIL_SECRET", "CLOUDFLARE_EMAIL_ACCOUNT_ID"],
  },
  {
    title: "Harbor storage",
    label: "Store",
    status: "demo",
    body: "Walrus-backed Harbor buckets store encrypted body and attachment bytes.",
    details: ["Workspace credentials", "AES-GCM files", "Harbor IDs in Postgres"],
  },
  {
    title: "MemWal RAG",
    label: "RAG",
    status: "demo",
    body: "User-owned memory index keyed by the signed-in zkLogin Sui address.",
    details: ["Delegate key", "Document chunks", "Recall snippets"],
  },
];

export function FeaturePanels() {
  return (
    <div className="feature-panels" aria-label="Feature modules">
      {panels.map((panel) => (
        <article className="feature-card" key={panel.title}>
          <div className="feature-card-topline">
            <span>{panel.label}</span>
            <strong>{panel.status}</strong>
          </div>
          <h3>{panel.title}</h3>
          <p>{panel.body}</p>
          <ul>
            {panel.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
