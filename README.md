# Idealista Tracker

Scrapes idealista listings and saves them to Notion. Includes a Telegram bot for managing apartments from your phone.

## Features

- **Scrape listings**: Send an idealista link → extracts title, price, location, photos, contact info, features
- **Notion database**: All data stored in a structured Notion DB with status tracking, scoring, and notes
- **Telegram bot**: Search by phone/name, change status, add notes, schedule visits
- **Calendar integration**: One-click Google Calendar event creation with location and guest invite
- **Deduplication**: Detects if a listing was already saved
- **Photo backup**: Downloads all listing photos locally in case the ad is removed

## Setup

### Prerequisites

- Node.js 18+
- Google Chrome installed
- A Notion account
- A Telegram account

### 1. Install dependencies

```bash
npm install
npx playwright install chromium
```

### 2. Configure Notion

1. Go to https://www.notion.so/my-integrations → create a new integration
2. Create a full-page database in Notion
3. Share the database with your integration (click `...` → Connections → add it)
4. Copy the integration token and the database ID from the URL

### 3. Configure Telegram

1. Open Telegram → search @BotFather → `/newbot`
2. Copy the bot token

### 4. Environment variables

```bash
cp .env.example .env
```

Fill in your `.env`:

```
NOTION_TOKEN=secret_...
NOTION_DATABASE_ID=...
TELEGRAM_BOT_TOKEN=...
GUEST_EMAIL=persona@example.com
```

`GUEST_EMAIL` is optional. If you leave it empty, the Calendar invitation is created without adding a guest.

### 5. Run

**CLI** (one-off scrape):

```bash
npm run scrape "https://www.idealista.com/inmueble/12345678/"
```

**Telegram bot** (long-running):

```bash
npm run bot
```

**Run in background** (survives terminal close):

```bash
nohup npm run bot > bot.log 2>&1 &
```

Check if it's running:

```bash
ps aux | grep "tsx src/bot" | grep -v grep
```

View logs:

```bash
tail -f bot.log
```

Stop the bot:

```bash
pkill -f "tsx src/bot"
```

## Windows portable package

If you want to hand someone a ready-to-run `.zip` for Windows, the simplest approach is:

1. Open the project on a Windows machine
2. Install dependencies with `npm install`
3. Build a portable folder with:

```bash
npm run package:portable
```

If you already filled the real `.env` with the recipient's keys and want that file copied into the final package, run:

```bash
npm run package:portable -- --env-source=.env
```

That creates `portable/idealista-bot/` with:

- compiled app in `dist/`
- dependencies in `node_modules/`
- empty runtime folders (`data/`, `logs/`, `.browser-profile/`)
- Windows launchers:
  - `Inicializar Navegador.cmd`
  - `Iniciar Bot.cmd`
  - `Detener Bot.cmd`
  - `Ver Logs.cmd`

Then zip that `portable/idealista-bot/` folder and send it.

### Windows notes

- Build the portable folder on Windows, not macOS, for best compatibility
- Google Chrome must be installed on the Windows machine
- Node.js 18+ must be installed on the Windows machine for this first portable version
- The browser profile inside `.browser-profile/` is local to that folder and should be initialized on the same Windows machine where it will run
- On first run, execute `Inicializar Navegador.cmd`, accept cookies and/or log in to Idealista, then close Chrome
- The bot keeps running after double click; it stops when the PC shuts down or when `Detener Bot.cmd` is used

## Bot commands

| Command     | Description               | Example                                        |
| ----------- | ------------------------- | ---------------------------------------------- |
| Send a link | Scrape and save to Notion | `https://www.idealista.com/inmueble/12345678/` |
| `/buscar`   | Search by phone or name   | `/buscar 612345678`                            |
| `/estado`   | Change apartment status   | `/estado 12345678 contactado`                  |
| `/nota`     | Add contact note          | `/nota 12345678 Llamé por WhatsApp`            |
| `/visita`   | Create Calendar event     | `/visita 12345678 1504 1800`                   |
| `/ayuda`    | Show help                 | `/ayuda`                                       |

**Valid statuses**: `nuevo`, `contactado`, `sin_respuesta`, `visita_programada`, `visitado`, `descartado`, `interesado`

**Visit date format**: `DDMM HHMM` (24h) — e.g., `1504 1800` = April 15, 18:00

## Project structure

```
src/
  index.ts      # CLI entry point
  bot.ts        # Telegram bot entry point
  scraper.ts    # Playwright scraper for idealista
  notion.ts     # Notion API client (search, create, update)
  types.ts      # Shared types
data/
  images/       # Downloaded listing photos
  snapshots/    # Saved HTML for offline testing
```
