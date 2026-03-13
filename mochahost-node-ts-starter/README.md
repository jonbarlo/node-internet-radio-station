# Mochahost Node.js + TypeScript Starter

Out-of-the-box Node TS app that runs on **Mochahost** (IIS/iisnode) without 500 errors. Use this to spin off new APIs quickly.

**In this repo:** The main backend lives in `backend/` (radio-station-backend); it was built from this pattern and adds streams, HLS, and a simple player. This folder is the minimal reference template.

---

## What to set and change

### 1. Run locally

| Step | What to do |
|------|------------|
| **Env** | Copy `.env.example` to `.env`: `cp .env.example .env` |
| **Port** | In `.env` set `PORT=3000` (or any port). App uses `process.env.PORT \|\| 3000`. |
| **Install** | `npm install` |
| **Run** | `npm run dev` → server at `http://localhost:3000` |
| **Endpoints** | `GET /` and `GET /health` |

No need to set FTP vars for local dev. Leave `FTP_*` in `.env` as placeholders or remove them; they’re only used by `npm run deploy-mochahost`.

### 2. Deploy to Mochahost

| Step | What to do |
|------|------------|
| **Production env** | Create **`.env.prod`** in the project root (same folder as `package.json`). |
| **Required in .env.prod** | `NODE_ENV=production`, `PORT=3000` (or leave empty; IIS sets PORT). |
| **FTP in .env.prod** | Set real FTP credentials so the deploy script can upload: |
| | `FTP_HOST=ftp.yourdomain.com` |
| | `FTP_USER=your_ftp_username` |
| | `FTP_PASSWORD=your_ftp_password` |
| | `FTP_PORT=21` |
| | `FTP_SECURE=false` |
| | `FTP_REMOTE_PATH=/` (or the folder where the app should live, e.g. `/httpdocs`) |
| **Deploy** | From project root: `npm run deploy-mochahost` |
| **On the server** | In Plesk (or SSH), open the app root (where `package.json` and `web.config` are) and run: |
| | `npm install --production` |
| **Restart** | Restart the IIS/Node application in Plesk. |
| **Test** | Open `https://your-domain/` and `https://your-domain/health` |

### 3. If you rename the project

- Change `name` in `package.json`.
- Change the app name in `src/app.ts` in the `GET /` response if you want.
- Keep `web.config` as-is (it points to `dist/server.js`).
- Keep the structure: `src/loadEnv.ts` first, `src/server.ts` entry, dot notation for `process.env`, port = `process.env.PORT || 3000`.

---

## Project structure (do not break)

```
mochahost-node-ts-starter/
├── .env              # Local (from .env.example), never commit
├── .env.prod         # Production + FTP, never commit
├── .env.example      # Template, commit
├── src/
│   ├── loadEnv.ts    # Runs first – loads .env (exact Mochahost pattern)
│   ├── server.ts     # Entry – port = process.env.PORT || 3000
│   ├── app.ts        # Express app
│   └── config/
│       └── env.ts    # Reads process.env only (dot notation)
├── scripts/
│   └── deploy-mochahost.ts
├── web.config        # Minimal IIS – do not add extra sections
├── package.json
└── tsconfig.json
```

---

## Why this works on Mochahost

1. **Dotenv** – Loaded in `loadEnv.ts` with the exact pattern (`let dotenvResult`, `let envPath`, try/catch, `path.resolve(__dirname, '../.env')`). That file is imported first in `server.ts`, so `.env` is loaded before any code reads `process.env`.
2. **process.env** – Only **dot notation** is used (`process.env.PORT`, `process.env.NODE_ENV`). No `process.env['PORT']`.
3. **Port** – In `server.ts`, port is always `process.env.PORT || 3000`. Never set to `undefined` in production; IIS sets `PORT`.
4. **web.config** – Minimal: only iisnode, handlers, and one rewrite to `dist/server.js`. No extra security or rewrite rules.
5. **Server** – After upload, `npm install --production` installs `dotenv` and `express` so the app finds them.

For the full guide and exact code rules, see **`../docs/MOCHAHOST-NODE-TS-GUIDE.md`** in this repo.
