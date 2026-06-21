<div align="center">
  <h1>Mermail</h1>
  <p><em>It's not AI for your email. It's email for your AI.</em></p>
</div>

**Mermail** is the email inbox API for AI agents. It gives agents their own email inboxes with PostgreSQL-backed metadata and Harbor-backed mail blobs encrypted with workspace-owned storage credentials.

Incoming emails arrive via [Cloudflare Email Routing](https://developers.cloudflare.com/email-routing/) and are forwarded by a small Worker to the Next.js app. Product API logic now lives in `app/api`, metadata/state lives in PostgreSQL through Prisma, and full email bodies plus attachment bytes stay in Harbor.

An **AI-powered Email Agent** can read your inbox, search conversations, and draft replies through the app API and DeepSeek-compatible server integrations.

---

## Table of Contents

- [Running locally](#running-locally)
- [Telegram bot setup](./TELEGRAM_SETUP.md)
- [Deploying to Cloudflare](#deploying-to-cloudflare)
- [Storage & Access Control](#storage--access-control)
- [Features](#features)
- [Architecture](#architecture)
- [Stack](#stack)
- [License](#license)

---

## Running locally

The app runs as a Next.js application backed by PostgreSQL. The Cloudflare Worker is only needed when testing or deploying inbound Email Routing.

### Prerequisites

- **Node.js 20+** — check with `node -v`
- **Yarn 1.22+** — check with `yarn -v`

### 1. Install dependencies

```bash
yarn install
```

### 2. Start the dev server

```bash
yarn dev
```

Once ready you will see:

```
➜  Local:   http://localhost:3000/
```

Open that URL in your browser. You should see the **Mailboxes** screen.

### 3. Configure PostgreSQL

Copy `.env.example` to `.env` and set `DATABASE_URL`, `WORKSPACE_SECRET_KEY`, and any Enoki/MemWal keys you need. Then run Prisma migrations for your database:

```bash
yarn prisma migrate dev
```

### 4. Create a mailbox

Click **+ New Mailbox** and enter any allowed email address.

### 5. Send a test email (optional)

Use the **Compose** button inside a mailbox. Outbound delivery uses Cloudflare Email Service REST when `CLOUDFLARE_EMAIL_ACCOUNT_ID` and `CLOUDFLARE_EMAIL_API_TOKEN` are configured.

### Environment variables (optional overrides)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | _required_ | PostgreSQL connection string for Prisma |
| `INTERNAL_EMAIL_SECRET` | _required for inbound mail_ | Shared secret between Worker and Next internal email route |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Public Next app URL for the app build/runtime |
| `DOMAINS` | `example.com` | Comma-separated domains for email addresses |
| `EMAIL_ADDRESSES` | `[]` | Allowlist of email addresses. Empty = allow all |
| `ENOKI_SECRET_KEY` | optional | Enoki sponsored transactions |
| `CLOUDFLARE_EMAIL_ACCOUNT_ID` / `CLOUDFLARE_EMAIL_API_TOKEN` | optional | Cloudflare Email Service REST for outbound mail |
| `POLAR_SERVER` | `sandbox` | Polar API environment, either `sandbox` or `production` |
| `POLAR_ACCESS_TOKEN` | optional | Server-only Polar organization access token for checkout sessions |
| `POLAR_WEBHOOK_SECRET` | optional | Server-only Polar webhook signing secret for `/api/webhooks/polar` |
| `POLAR_DEVELOPER_PRODUCT_ID` | optional | Polar product ID for the Developer plan shown on `/pricing` |
| `RECAPTCHA_SECRET_KEY` | required for waitlist | Server-only Google reCAPTCHA v3 secret for `/api/waitlist` |

Harbor API keys and service private keys are entered per workspace from the Workspace Storage UI, then encrypted with `WORKSPACE_SECRET_KEY` before being stored.

For local Polar webhook testing, expose the Next app with a tunnel such as `ngrok http 3000` and register `https://<your-tunnel>/api/webhooks/polar` in Polar. You can also use the Polar CLI with `polar listen http://localhost:3000/` and copy the printed secret into `POLAR_WEBHOOK_SECRET`.

In production, register the console webhook endpoint in Polar as Raw JSON:

```text
https://console.mermail.app/api/webhooks/polar
```

If the deployed console host changes, use `https://<actual-console-host>/api/webhooks/polar` instead. The Polar endpoint secret must exactly match server-only `POLAR_WEBHOOK_SECRET`. Subscribe to `checkout.updated`, `order.created`, `order.paid`, `subscription.created`, `subscription.active`, `subscription.updated`, `subscription.canceled`, `subscription.uncanceled`, `subscription.revoked`, and `subscription.past_due`.

### Troubleshooting local dev

| Symptom | Fix |
|---|---|
| Page loads but API calls fail | Check `DATABASE_URL` and run Prisma migrations |
| Inbound email is rejected | Make sure Worker `INTERNAL_EMAIL_SECRET` matches the Next app env |
| Sending fails with Cloudflare Email authentication | Confirm `CLOUDFLARE_EMAIL_ACCOUNT_ID` is the account that owns the sending domain, rotate `CLOUDFLARE_EMAIL_API_TOKEN` with `Account > Email Sending > Edit`, verify the sender domain is onboarded for Email Sending, and restart the app after env changes |
| Port 3000 already in use | Run `yarn dev -p 3001` |

---

## Deploying to Cloudflare

Deploy the Next.js app and the Cloudflare Email Routing Worker separately.

### Next.js app

Deploy the Next app to a Node-compatible host and set the variables from `.env.example`. At minimum you need `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`, `INTERNAL_EMAIL_SECRET`, `DOMAINS`, `EMAIL_ADDRESSES`, and `WORKSPACE_SECRET_KEY`. To enable paid checkout, also set `POLAR_SERVER`, `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, and `POLAR_DEVELOPER_PRODUCT_ID`.

```bash
yarn build
yarn prisma migrate deploy
```

### Email Routing Worker

The Worker only receives Cloudflare Email Routing events and forwards raw MIME to the Next app.

```bash
yarn wrangler login
yarn wrangler secret put INTERNAL_EMAIL_SECRET
```

Update the Worker `APP_URL` in `wrangler.jsonc` to the same public URL as `NEXT_PUBLIC_APP_URL`, then deploy:

```bash
yarn deploy:worker
```

In Cloudflare Email Routing, point the catch-all or target address rule to this Worker.

### Troubleshooting production

| Error | Cause & fix |
|---|---|
| Emails not arriving | Check Email Routing points to the Worker and Worker `APP_URL` points to the Next app |
| `Unauthorized` from `/api/internal/email-routing` | Worker and Next app `INTERNAL_EMAIL_SECRET` values do not match |
| API calls fail | Check `DATABASE_URL` and run `yarn prisma migrate deploy` |
| Attachments/body missing | Check the workspace Harbor storage settings and bucket creation status |

---

<a name="storage--access-control"></a>
## Storage & Access Control

PostgreSQL stores mailbox, folder, email, attachment, thread, mailbox settings, and RAG metadata. Harbor stores full email bodies and attachment bytes encrypted server-side with workspace-owned credentials.

| Aspect | Detail |
|---|---|
| **Metadata** | PostgreSQL via Prisma |
| **Full email body** | Harbor file ID stored on `Email.harborBodyFileId` |
| **Attachments** | Harbor file ID stored on `Attachment.harborFileId` |
| **Inbound transport** | Cloudflare Email Routing Worker forwards raw MIME to Next |

## Cost & Free-tier Reality

The Worker no longer uses Durable Objects. Its Cloudflare cost is only Worker invocations for inbound mail routing, plus outbound Email Service REST usage if configured.

| Service | Cost | Notes |
|---|---|---|
| **PostgreSQL** | Depends on provider | Required for app metadata/state |
| **Harbor** | Depends on Harbor/Walrus usage | Stores full email bodies and attachments |
| **Cloudflare Workers** | Usually tiny for mail ingress | No Durable Objects required |
| **Cloudflare Email Routing** | Free for inbound routing | Worker invocation still counts as Worker usage |
| **Cloudflare Email Service** | Usage-based for outbound send | Only needed for compose/reply/forward delivery |
| **DeepSeek / AI** | Usage-based | Optional AI features |

---

## Features

- **Full email client** — Send and receive emails with rich text composer, reply/forward threading, folder organisation, search, and attachment support
- **Harbor-backed mail blobs** — Full email bodies and attachments are encrypted and stored in Harbor, with metadata in PostgreSQL
- **Prisma-backed mailbox state** — Mailboxes, folders, threads, flags, and RAG metadata live in PostgreSQL
- **Built-in AI surfaces** — Side panels and server integrations for search, drafting, and RAG-assisted workflows
- **Prompt injection protection** — Incoming emails and thread history are scanned for injection attempts before being fed to the agent
- **Configurable** — Custom system prompts and mailbox settings per workspace
- **Agent Discovery & Payments** — Built-in support for [DNS-AID (DNS for AI Discovery)](./DNS_AID.md), OAuth/OIDC metadata, WebMCP client API, and agentic commerce standards (UCP, ACP, MPP, x402)

---

## Architecture

```
Cloudflare Email Routing
        ↓
Cloudflare Worker
  - forwards raw MIME only
        ↓
Next.js app/api
  - mailbox/email/folder/search/RAG API
  - internal inbound email parser
        ↓
PostgreSQL via Prisma + Harbor blobs
```

---

## Stack

- **Frontend/API:** Next.js App Router, React 19, Tailwind CSS v4, Zustand, TipTap
- **Database:** PostgreSQL via Prisma
- **Blob storage:** Harbor for full email bodies and attachments
- **Worker:** Cloudflare Email Routing ingress only
- **AI/RAG:** MemWal/Enoki/DeepSeek-compatible server integrations

---

## License

Apache 2.0 — see [LICENSE](LICENSE).
