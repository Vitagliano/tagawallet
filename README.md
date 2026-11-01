# TagAWallet

A private wallet identity layer: tag addresses, group them under entities, and recognize them in the browser. See [tagawallet-prd.md](tagawallet-prd.md).

| Path | What it is |
|---|---|
| `apps/web` | Next.js dashboard, API and public profiles (MongoDB) |
| `apps/extension` | Manifest V3 browser extension for Chrome, Brave and Edge |
| `packages/shared` | Address validation and detection, URL sanitizing, schemas |
| `e2e` | Playwright suite: API, web UI, and the extension in Chromium |

## Run it locally

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev:db    # in one terminal: a local MongoDB, kept in .dev-db
pnpm dev       # in another: http://localhost:3000
```

Without `RESEND_API_KEY`, emails such as password resets and invitations are printed to the server log.

To load the extension, run `pnpm --filter @tagawallet/extension build`, open `chrome://extensions`, turn on Developer mode, and use **Load unpacked** on `apps/extension/dist`.

## Test

```bash
pnpm test        # unit tests
pnpm typecheck
pnpm build       # the e2e suite runs against the production build
pnpm test:e2e
```

## Ship it

- **Web:** deploy `apps/web` with `MONGODB_URI`, `APP_URL` and `ADMIN_EMAILS` set, plus the optional keys in `.env.example`.
- **Extension:** `TAW_RELEASE=1 pnpm --filter @tagawallet/extension build` targets `https://tagawallet.com`. Use `TAW_API_BASE` for any other host. It must match `APP_URL`.
- **Supported sites:** served from `GET /api/extension/sites`. Admins can change the list with `PUT`, without a new extension release.

## Decisions on the PRD's open questions

- **Chains:** Ethereum, Base, Arbitrum, Optimism, Polygon, BNB Chain, Solana and Bitcoin.
- **Browsers:** Chromium only at launch.
- **Public lists:** not allowed. A list can be private or shared. Only entities can be public, because they go through the verification and moderation rules.
- **Community tags:** not in v1. Public labels are self-claimed or verified.
- **Wallet proof:** not required for every public claim, but required to link a wallet publicly to an individual. Profiles of individuals must be verified before publishing.
