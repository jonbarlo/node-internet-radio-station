# Radio Station – Web App

Frontend that consumes the radio station backend API (stream list, HLS playback).

**Status:** Placeholder. To be implemented (e.g. React + Vite + hls.js).

**Backend API (ready):**
- `GET /streams` – list channels with `id`, `name`, `playlistUrl`, `hasPlaylist`
- `GET /streams/:id/playlist.m3u8` – HLS playlist (and segments under `/streams/:id/`)

For development and testing, the backend serves a minimal HLS player at **`/player`** (see `backend/public/player.html`). The standalone app in this folder will be the main web frontend when built.
