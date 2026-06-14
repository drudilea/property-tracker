# Idealista Tracker

A local, cross-platform **Electron desktop app** for an apartment search: it
captures Idealista listings, scrapes their details with a real Chrome, and saves
them to **your own Notion database**. 100% local — your data lives in your Notion
and on your machine, no shared backend.

## What it does

- **Capture** a listing three ways:
  - **Paste a link** in the app (instant, desktop).
  - **❤️ it on Idealista** from any device — the app reads your favorites and syncs the new ones.
  - **Send it to an optional Telegram bot** (off by default; mobile push while the app is open).
- **Scrape** title, price, location, features, contact and photos using your **installed Chrome** (so it gets past the anti-bot).
- **Save to Notion** (with de-duplication). You organize, filter and track in Notion.
- **Schedule visits**: builds a prefilled Google Calendar event and marks the listing `visita_programada`.

## Requirements

- **Node.js 18+** and npm (to run/build from source)
- **Google Chrome** installed
- A **Notion** account + an internal integration token
- _(optional)_ A **Telegram** bot token (from @BotFather) for mobile capture

## Develop

```bash
npm install
npm run dev
```

## Package the app

```bash
npm run pack   # → release/ : .app on macOS, portable .exe on Windows
```

Unsigned builds show a one-time security prompt (macOS Gatekeeper "Open Anyway" /
Windows SmartScreen "Run anyway"). Building for both platforms is done via CI
(GitHub Actions) since Windows can't be built reliably from macOS.

## First-run setup (inside the app)

1. **Notion** — create an internal integration at `notion.so/my-integrations`,
   share your database with it, then paste the **token** + **database id** and
   click _Conectar_.
2. **Idealista** — click _Iniciar sesión en Idealista_ and log in (the window
   stays open and is reused).
3. **Capture** — paste a link, _Sincronizar favoritos_, or enable Telegram.

The token, chosen database, and the dedicated browser profile are stored under
the OS user-data directory (e.g. `~/Library/Application Support/Idealista Tracker/`
on macOS). Nothing is committed or shared.

## Scripts

| Script              | What it does                            |
| ------------------- | --------------------------------------- |
| `npm run dev`       | Run the app in development (hot reload) |
| `npm run build:app` | Build main/preload/renderer bundles     |
| `npm run pack`      | Build + package with electron-builder   |
| `npm test`          | Run unit tests (vitest)                 |
| `npm run typecheck` | `tsc --noEmit`                          |
| `npm run lint`      | ESLint                                  |
| `npm run format`    | Prettier                                |

## Architecture (brief)

- **Electron main** (Node) runs the business logic in `app/main/`: the browser
  session and listing parser (scraping), `notion`/`calendar`, and the services
  (scrape, favorites, visits, telegram). Shared types live in `app/shared/`.
- **Renderer** is a minimal control panel; it talks to the main process only
  through a typed IPC bridge (`app/preload`, `app/shared/ipc-contract.ts`).
- A **single shared Chrome session** (login / scrape / favorites) lives in
  `BrowserSession`; its internal mutex serializes every access, so the browser
  profile is never opened twice at once and no caller can bypass the lock.
