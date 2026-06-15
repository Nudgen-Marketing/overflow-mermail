export interface ServerEnv {
  DATABASE_URL?: string;
  INTERNAL_EMAIL_SECRET?: string;
  NEXT_PUBLIC_APP_URL?: string;
  APP_URL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
  CLOUDFLARE_EMAIL_ACCOUNT_ID?: string;
  CLOUDFLARE_EMAIL_API_TOKEN?: string;
  WORKSPACE_SECRET_KEY?: string;
  MEMWAL_SERVER_URL?: string;
  NEXT_PUBLIC_ENOKI_API_KEY?: string;
}

export function getServerEnv(): ServerEnv {
  return {
    DATABASE_URL: process.env.DATABASE_URL,
    INTERNAL_EMAIL_SECRET: process.env.INTERNAL_EMAIL_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    APP_URL: process.env.APP_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    CLOUDFLARE_EMAIL_ACCOUNT_ID: process.env.CLOUDFLARE_EMAIL_ACCOUNT_ID,
    CLOUDFLARE_EMAIL_API_TOKEN: process.env.CLOUDFLARE_EMAIL_API_TOKEN,
    WORKSPACE_SECRET_KEY: process.env.WORKSPACE_SECRET_KEY,
    MEMWAL_SERVER_URL: process.env.MEMWAL_SERVER_URL,
    NEXT_PUBLIC_ENOKI_API_KEY: process.env.NEXT_PUBLIC_ENOKI_API_KEY,
  };
}

export function hasEnvValue(value?: string | null) {
  return Boolean(value?.trim());
}
