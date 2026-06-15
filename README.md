# Clone Mail zkLogin Demo

This repository is a compact OAuth using Enoki zkLogin demo extracted for submission. It keeps the authentication flow independent from the original application history and avoids copying mail, storage, billing, or workspace code.

## What is included

- Google OAuth redirect through Enoki zkLogin.
- `/auth` callback handling for the Enoki flow.
- JWT cookie/session persistence with Google profile display.
- Sui address display for the zkLogin identity.
- Demo-only signed session headers using a personal-message signature.

## Scripts

```bash
yarn install
yarn dev
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

- `NEXT_PUBLIC_ENOKI_API_KEY`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `NEXT_PUBLIC_SUI_NETWORK`
- `NEXT_PUBLIC_SUI_FULLNODE_URL`
- `NEXT_PUBLIC_ENOKI_REDIRECT_URL`, optional; defaults to the current origin plus `/auth`

The Google OAuth application should allow the same redirect URL shown in `.env.example`, such as `http://localhost:3000/auth` during local development.

## Verification

```bash
yarn test
yarn typecheck
yarn build
```

With env values configured, run `yarn dev`, open `http://localhost:3000`, sign in with Google, and confirm the dashboard shows the Google profile, Sui address, JWT status, and generated `X-Sui-*` session headers.
