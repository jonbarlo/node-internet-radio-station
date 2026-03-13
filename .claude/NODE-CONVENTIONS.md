# Node.js + TypeScript Conventions (this project)

## Project structure (backend)

- **Feature-based** layout under `src/`: group by domain (e.g. `streams`, `health`), not only by layer.
- **Separate app from server**: `app.ts` exports the Express app; `server.ts` loads env, starts listen.
- **Single entry**: build outputs to `dist/` with one main file (e.g. `dist/server.js`) for Mochahost.

```
backend/
├── src/
│   ├── app.ts           # Express app (no listen)
│   ├── server.ts        # dotenv, listen (entry)
│   ├── config/          # env, constants
│   ├── modules/         # feature folders (streams, health, ...)
│   │   ├── health/
│   │   └── streams/
│   ├── middlewares/
│   └── types/
├── dist/                # compiled output
├── package.json
├── tsconfig.json
└── web.config           # minimal IIS/iisnode (Mochahost)
```

## Environment and config

- **One config module** that reads `process.env` (dot notation only).
- **Dotenv**: load once at startup using the exact Mochahost-safe pattern (see MOCHAHOST-QUICKSTART.md).
- **Port**: `const port = process.env.PORT || 3000`; let IIS assign in production.

## API design

- **REST** for resources (e.g. `GET /streams`, `GET /streams/:id`, `GET /streams/:id/playlist.m3u8`).
- **JSON** responses; consistent error shape `{ status: 'error', error: string }`.
- **Global error handler** so no uncaught throws; return JSON errors, not HTML 500.

## HLS and streaming (planned)

- **Option A**: Pre-segment MP3 → HLS (ffmpeg) into `.m3u8` + `.ts`; serve as static files from stream folders.
- **Option B**: Use a Node HLS library (e.g. node-hls-server, or custom segmenter) if on-the-fly transcoding is required.
- **Streams**: each “stream” = one folder of media (or pre-generated HLS segment folder); API exposes stream list and playlist/segment URLs for web and Flutter clients.

## Database

- **Start without a DB**; add **Prisma** only when needed (e.g. users, metadata, playlists).
- If added: single Prisma client instance; no duplicate DB connections.

## Mochahost (critical)

- **Minimal web.config**: only iisnode, handlers, one rewrite to `dist/server.js`.
- **process.env.VAR** only (no bracket notation).
- **Dotenv**: try/catch, explicit path `path.resolve(__dirname, '../.env')` when running from `dist/`.
- **No assigning port to undefined** in production; use `process.env.PORT || 3000`.
