export interface Env {
  APP_URL: string;
  INTERNAL_EMAIL_SECRET: string;
}

function internalEmailUrl(appUrl: string) {
  return new URL("/api/internal/email-routing", appUrl).toString();
}

export default {
  async fetch() {
    return new Response("Clone Mail email router is running.", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  },

  async email(event: { raw: ReadableStream; rawSize: number }, env: Env) {
    if (!env.APP_URL) throw new Error("APP_URL is not configured.");
    if (!env.INTERNAL_EMAIL_SECRET) {
      throw new Error("INTERNAL_EMAIL_SECRET is not configured.");
    }

    const response = await fetch(internalEmailUrl(env.APP_URL), {
      method: "POST",
      headers: {
        "Content-Type": "message/rfc822",
        "X-Internal-Secret": env.INTERNAL_EMAIL_SECRET,
        "X-Raw-Email-Size": String(event.rawSize),
      },
      body: event.raw,
    });

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(
        `Next email ingestion failed [${response.status}]: ${message}`,
      );
    }
  },
};
