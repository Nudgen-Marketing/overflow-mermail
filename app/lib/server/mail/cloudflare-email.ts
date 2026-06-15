import type { SendEmailRequest } from "~/lib/email/schemas";
import { getServerEnv, type ServerEnv } from "~/lib/server/env";

const AUTHENTICATION_ERROR_MESSAGE =
  "Cloudflare Email authentication failed. Check CLOUDFLARE_EMAIL_ACCOUNT_ID and CLOUDFLARE_EMAIL_API_TOKEN.";
const SENDING_DISABLED_ERROR_MESSAGE =
  "Cloudflare Email Sending is disabled for this sender domain or account.";
const GENERIC_ERROR_MESSAGE = "Cloudflare Email send failed.";
const SENDING_DISABLED_ERROR_CODES = new Set([10105, 10203]);

export interface CloudflareEmailProviderError {
  code?: number;
  message: string;
}

export class CloudflareEmailSendError extends Error {
  readonly status = 502;
  readonly providerStatus: number;
  readonly providerErrors: CloudflareEmailProviderError[];

  constructor(
    providerStatus: number,
    providerErrors: CloudflareEmailProviderError[] = [],
  ) {
    super(getCloudflareEmailErrorMessage(providerStatus, providerErrors));
    this.name = "CloudflareEmailSendError";
    this.providerStatus = providerStatus;
    this.providerErrors = providerErrors;
  }
}

function getCloudflareEmailErrorMessage(
  providerStatus: number,
  providerErrors: CloudflareEmailProviderError[],
) {
  if (
    providerErrors.some(
      (error) => error.code && SENDING_DISABLED_ERROR_CODES.has(error.code),
    )
  ) {
    return SENDING_DISABLED_ERROR_MESSAGE;
  }
  if (providerStatus === 401 || providerStatus === 403) {
    return AUTHENTICATION_ERROR_MESSAGE;
  }
  return GENERIC_ERROR_MESSAGE;
}

function normalizeAddress(value: string | { email: string; name: string }) {
  if (typeof value === "string") return value;
  return { address: value.email, name: value.name };
}

async function parseCloudflareErrors(response: Response) {
  const body = await response.text().catch(() => "");
  if (!body) return [];
  try {
    const parsed = JSON.parse(body.slice(0, 2_000)) as {
      errors?: { code?: unknown; message?: unknown }[];
    };
    if (!Array.isArray(parsed.errors)) return [];
    return parsed.errors
      .map((error) => ({
        ...(typeof error.code === "number" ? { code: error.code } : {}),
        message:
          typeof error.message === "string" && error.message.trim()
            ? error.message.trim()
            : "Unknown Cloudflare Email error",
      }))
      .filter((error) => error.message);
  } catch {
    return [];
  }
}

export function buildCloudflareEmailPayload(params: SendEmailRequest) {
  return {
    to: params.to,
    from: normalizeAddress(params.from),
    subject: params.subject,
    ...(params.html ? { html: params.html } : {}),
    ...(params.text ? { text: params.text } : {}),
    ...(params.cc ? { cc: params.cc } : {}),
    ...(params.bcc ? { bcc: params.bcc } : {}),
    ...(params.attachments?.length ? { attachments: params.attachments } : {}),
  };
}

export async function sendEmail(
  params: SendEmailRequest,
  input: {
    env?: ServerEnv;
    fetchFn?: typeof fetch;
  } = {},
) {
  const env = input.env ?? getServerEnv();
  const fetchFn = input.fetchFn ?? fetch;
  if (!env.CLOUDFLARE_EMAIL_ACCOUNT_ID || !env.CLOUDFLARE_EMAIL_API_TOKEN) {
    return null;
  }

  const response = await fetchFn(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_EMAIL_ACCOUNT_ID}/email/sending/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_EMAIL_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildCloudflareEmailPayload(params)),
    },
  );

  if (!response.ok) {
    throw new CloudflareEmailSendError(
      response.status,
      await parseCloudflareErrors(response),
    );
  }

  return response.json();
}
