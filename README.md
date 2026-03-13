# Node Internet Radio Station

Monorepo for a radio station backend (Node + TypeScript), web app, and Flutter mobile app. The backend hosts files and exposes HLS streams (one stream per folder of pre-segmented media).

## Production

- **Live site:** [https://radio.506software.com/](https://radio.506software.com/) — API info and endpoints.
- **Player:** [https://radio.506software.com/player](https://radio.506software.com/player) — HLS channel player (select a channel to listen).

## Structure

| Folder    | Purpose |
|----------|---------|
| **backend/** | Node.js + TypeScript API. Health check, future stream list and HLS serving. Deployable to Mochahost (IIS/iisnode). |
| **web/**     | Frontend web app (placeholder). Will consume backend API and play HLS. |
| **mobile/**  | Flutter app (placeholder). Will consume same API and HLS URLs. |
| **.claude/** | Conventions: [TypeScript style guide](https://mkosir.github.io/typescript-style-guide/), Node conventions, and [development plan](.claude/DEVELOPMENT-PLAN.md). |
| **docs/** | **[MOCHAHOST-NODE-TS-GUIDE.md](docs/MOCHAHOST-NODE-TS-GUIDE.md)** – Ultimate guide with exact code for Node TS apps on Mochahost. |
| **mochahost-node-ts-starter/** | Copy-paste starter: minimal Node TS API + web.config + deploy script + .env.example + README. Use it to spin off new Mochahost apps fast. |

## Hosting (Mochahost)

Deployment and env rules are in **[MOCHAHOST-QUICKSTART.md](MOCHAHOST-QUICKSTART.md)**. The backend is written to follow them (dot notation for `process.env`, minimal web.config, dotenv loaded from entry with try/catch).

## Quick start (backend)

```bash
cd backend
cp .env.example .env
npm install
npm run build
npm run dev
```

- **Endpoints:** `GET /`, `GET /health`, `GET /streams` (list HLS channels), **`GET /player`** (web player with channel dropdown). Each channel is served from a local folder at `/streams/:id/` (e.g. `/streams/channel-1/playlist.m3u8`).
- **HLS from MP3:** Install [ffmpeg](https://ffmpeg.org/) (on Windows: [Install FFmpeg on Windows](https://www.wikihow.com/Install-FFmpeg-on-Windows) — add to PATH with `setx /m PATH "C:\ffmpeg\bin;%PATH%"`, then open a new terminal and run `ffmpeg -version` to confirm). From `backend/` run: `npm run generate-hls -- channel-1 path/to/audio.mp3` or `npm run generate-hls -- channel-1 path/to/mp3/folder`. Full steps: **`backend/channels/README.md`**.
- **Deploy:** Build outputs to `dist/`; entry is `dist/server.js`. Use `backend/web.config` on Mochahost.
- **FTP deploy:** From `backend/`, run `npm run deploy-mochahost`. Uses FTP credentials from `backend/.env.prod` (FTP_HOST, FTP_USER, FTP_PASSWORD, etc.). Builds locally, uploads `dist/`, `src/`, and config files; on the server run `npm install --production` and restart IIS.

## Conventions

- **TypeScript:** See `.claude/TYPESCRIPT-STYLE-GUIDE.md` and [mkosir.github.io/typescript-style-guide](https://mkosir.github.io/typescript-style-guide/).
- **Node / backend:** See `.claude/NODE-CONVENTIONS.md`.
- **Plan (HLS, phases, DB):** See `.claude/DEVELOPMENT-PLAN.md`.
