# Clone Mail zkLogin Demo

This repository is a compact clone-mail submission build. It keeps the authentication flow and feature adapters independent from the original application history while showing the important runtime boundaries: zkLogin identity, OpenAI-compatible LLM calls, Cloudflare Email send/receive, Harbor storage, and MemWal RAG.

## What is included

- Google OAuth redirect through Enoki zkLogin.
- `/auth` callback handling for the Enoki flow.
- JWT cookie/session persistence with Google profile display.
- Sui address display for the zkLogin identity.
- Demo-only signed session headers using a personal-message signature.
- OpenAI-compatible draft assist and prompt-safety helpers.
- Cloudflare Email Routing worker and Email Sending REST adapter.
- Harbor encrypted body/attachment storage adapter.
- MemWal credential, document indexing, and recall APIs.

## Scripts

```bash
yarn install
yarn dev
yarn db:generate
yarn test
yarn typecheck
yarn build
```

## Environment

Copy `.env.example` to `.env.local` and fill the Enoki and Google OAuth values before testing a real sign-in.

```bash
cp .env.example .env.local
```

Required values:

- `DATABASE_URL`
- `NEXT_PUBLIC_ENOKI_API_KEY`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `NEXT_PUBLIC_SUI_NETWORK`
- `NEXT_PUBLIC_SUI_FULLNODE_URL`
- `NEXT_PUBLIC_ENOKI_REDIRECT_URL`, optional; defaults to the current origin plus `/auth`
- `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`
- `INTERNAL_EMAIL_SECRET`
- `APP_URL`, Worker runtime only; points Cloudflare Email Routing at the Next app
- `CLOUDFLARE_EMAIL_ACCOUNT_ID`, `CLOUDFLARE_EMAIL_API_TOKEN`
- `WORKSPACE_SECRET_KEY`
- `MEMWAL_SERVER_URL`

The Google OAuth application should allow the same redirect URL shown in `.env.example`, such as `http://localhost:3000/auth` during local development.

## Feature routes

- `POST /api/ai/draft` returns an OpenAI-compatible customer-support draft.
- `POST /api/email/send` sends through Cloudflare Email Sending and stores sent metadata.
- `POST /api/internal/email-routing` receives raw MIME from the Worker with `X-Internal-Secret`.
- `POST /api/harbor/session` and `POST /api/harbor/api-key` create Harbor setup credentials from zkLogin-signed session headers.
- `POST /api/rag/credential?action=prepare|complete`, `POST /api/rag/documents`, and `POST /api/rag/recall` handle MemWal setup, indexing, and recall.

## Verification

```bash
yarn db:generate
yarn test
yarn typecheck
yarn build
```

With env values configured, run `yarn dev`, open `http://localhost:3000`, sign in with Google, and confirm the dashboard shows the Google profile, Sui address, JWT status, and generated `X-Sui-*` session headers.
