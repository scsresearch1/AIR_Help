# AIR_Help

AI Research Helper — citation extraction, PDF resolution, and research utilities.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Default login: `Admin` / `RM@1234`

## Netlify deployment (frontend + API)

Everything runs on Netlify: the React app is static, and `/api/*` is handled by a **Netlify Function** (`netlify/functions/api.mjs`).

1. Connect the repo to Netlify (build: `npm run build`, publish: `dist` — already in `netlify.toml`).
2. In **Netlify → Site settings → Environment variables**, add:
   - `UNPAYWALL_EMAIL` — your email for Unpaywall API
   - `NODE_TLS_REJECT_UNAUTHORIZED` = `0` (if behind SSL inspection)
   - `KAGGLE_USERNAME` / `KAGGLE_KEY` (optional, for Structured Data Extraction)
3. Deploy / redeploy the site.

Local dev: `npm run dev` — Vite proxies `/api` to the Express server on port 3001.
