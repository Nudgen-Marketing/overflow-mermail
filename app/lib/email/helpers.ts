export function stripHtmlToText(html: string) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function previewBody(body: string) {
  return stripHtmlToText(body).slice(0, 300);
}

export function normalizeAddressList(value?: string | string[] | null) {
  if (!value) return null;
  return (Array.isArray(value) ? value.join(", ") : value).toLowerCase();
}

export function extractMessageId(value?: string | null) {
  if (!value) return null;
  const match = value.match(/<([^>]+)>/);
  return match ? match[1] : value.trim().split(/\s+/)[0] || null;
}

export function generateMessageId(fromDomain: string) {
  const id = crypto.randomUUID();
  return {
    id,
    messageId: `${id}@${fromDomain}`,
  };
}

export function buildThreadingHeaders(
  inReplyTo?: string | null,
  references?: string[] | null,
) {
  if (!inReplyTo) return {};
  return {
    "In-Reply-To": `<${inReplyTo}>`,
    ...(references?.length
      ? { References: references.map((item) => `<${item}>`).join(" ") }
      : {}),
  };
}
