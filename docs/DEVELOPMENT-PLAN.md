# Radio Station – Development Plan

## Goal

- **Backend**: Node.js + TypeScript server that hosts files and exposes multiple HLS streams (each stream = folder of MP3 → HLS segments).
- **Web**: Frontend that consumes the backend (stream list, player).
- **Mobile**: Flutter app (later) consuming the same API and HLS URLs.

Start **minimal** (basic API, no DB, Mochahost-safe), then add streams and HLS step by step.

---

## Is it possible?

- **Yes.** HLS on Node is possible in two main ways:
  1. **Pre-segmented HLS**: Use ffmpeg (or a script) to turn MP3s into `.m3u8` playlists and `.ts` (or fMP4) segments; serve them as static files. No DB required for a simple “folder per stream” setup.
  2. **On-the-fly**: Use a Node HLS segmenter/server (e.g. node-hls-server, or custom pipeline with ffmpeg). More flexible but heavier; may be constrained on shared hosting (Mochahost).

Given **Mochahost** limitations (IIS/iisnode, minimal web.config, no heavy processes), the safest path is:

- **Phase 1**: Basic Express API (health, list “streams” from config or filesystem).
- **Phase 2**: Serve pre-generated HLS (m3u8 + segments) from stream folders; API returns stream list and playlist URLs.
- **Phase 3**: Optional automation (e.g. script or cron) to generate HLS from MP3s with ffmpeg.
- **DB**: Add **Prisma** only when needed (e.g. users, metadata, favorites).

---

## Repository layout

```
node-internet-radio-station/
├── .claude/                    # Conventions & plan
│   ├── TYPESCRIPT-STYLE-GUIDE.md
│   ├── NODE-CONVENTIONS.md
│   └── DEVELOPMENT-PLAN.md     # this file
├── backend/                    # Node + TS API + HLS serving
├── web/                        # Frontend web app (consumes API)
├── mobile/                     # Flutter app (placeholder)
├── MOCHAHOST-QUICKSTART.md     # Hosting rules (must follow)
└── web.config                  # Reference; copy into backend for deploy
```

---

## Phases

### Phase 1 – Minimal backend (current)

- **Backend** only; no DB.
- Express app in `backend/`: `src/app.ts`, `src/server.ts`.
- **Mochahost-safe**: dotenv with try/catch and exact path; `process.env.VAR` only; minimal web.config; entry `dist/server.js`.
- Endpoints:
  - `GET /` – simple welcome or API info.
  - `GET /health` – health check (for deploy and load balancers).
- Build: `npm run build` → `dist/`. Run: `npm run dev` (ts-node-dev or similar).
- **web** and **mobile**: folders created; placeholder README only.

### Phase 2 – Streams and HLS

- **Streams** = one folder per stream (e.g. `backend/streams/channel-a/` with pre-generated HLS).
- Config or convention: list of stream IDs and paths (e.g. env or `config/streams.json`).
- Endpoints:
  - `GET /streams` – list streams (id, name, playlist URL).
  - `GET /streams/:id/playlist.m3u8` (or proxy to static) – serve m3u8.
  - Segments served from same path or static middleware (e.g. `streams/:id/*.ts`).
- Pre-generation: document how to run ffmpeg to produce `.m3u8` + `.ts` per folder; optional npm script or separate tool.

### Phase 3 – Web app

- **Web** app (React/Vite or similar) in `web/`:
  - Fetches `GET /streams` from backend.
  - Embeds HLS player (e.g. hls.js) with playlist URL from API.
  - Deploy: build static assets; serve from same host or CDN; API stays in `backend/` (Mochahost).

### Phase 4 – Mobile (Flutter)

- **Mobile** in `mobile/`: Flutter app that calls same API and plays HLS (e.g. package that supports HLS). No backend changes required if API is already stream-list + URLs.

### Phase 5 – Optional DB (Prisma)

- When needed: add Prisma in `backend/` for users, favorites, or metadata.
- Single Prisma client; follow MOCHAHOST-QUICKSTART for env and single DB instance.

---

## Mochahost checklist (backend)

- [ ] `.env` in project root (backend root), never in `dist/`.
- [ ] Dotenv: exact pattern with try/catch and `path.resolve(__dirname, '../.env')` when run from `dist/`.
- [ ] All env access: `process.env.PORT` (no `process.env['PORT']`).
- [ ] Port: `process.env.PORT || 3000`.
- [ ] web.config minimal: iisnode, handlers, one rewrite to `dist/server.js`.
- [ ] Build outputs entry at `dist/server.js`.
- [ ] No top-level throws in routes; global JSON error handler.

---

## Tech choices (concise)

| Area        | Choice / note                                      |
|------------|----------------------------------------------------|
| Backend    | Node.js, TypeScript, Express                       |
| Hosting    | Mochahost (IIS/iisnode) – follow MOCHAHOST-QUICKSTART |
| HLS        | Pre-segmented (ffmpeg) → static files; API exposes URLs |
| DB         | None at start; add Prisma when needed              |
| Web        | TBD (e.g. React + Vite); consumes backend API      |
| Mobile     | Flutter; consumes same API + HLS URLs              |
| Style      | .claude/TYPESCRIPT-STYLE-GUIDE + NODE-CONVENTIONS  |
