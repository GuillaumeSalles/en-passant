# Operations

## Cloudflare

- Pages project: `enpassant`
- Canonical URL: `https://enpassant.io`
- Build command: `npm run build`
- Build output directory: `dist`

The frontend is a static GPL application. It expects backend routes to be
available at the same origin:

- `/api/auth/*`
- `/api/sync`

In production, route `/api/*` to the closed-source `en-passant-backend` Worker.
Keep backend secrets, D1 bindings, auth provider credentials, and email
configuration out of this repository.

## Local Dev

Run the frontend only:

```sh
npm run dev
```

When the backend repo is running locally on `127.0.0.1:8788`, Vite proxies
same-origin `/api/*` requests there by default. Override with:

```sh
LOCAL_FUNCTIONS_ORIGIN=http://127.0.0.1:8788 npm run dev
```

Most Playwright specs mock auth and sync endpoints, so Codex can continue doing
frontend e2e work without a local backend.
