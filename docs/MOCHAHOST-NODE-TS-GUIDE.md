# Ultimate Node.js + TypeScript Guide for Mochahost

This guide gives **exact code and rules** so Node TS apps run on Mochahost (IIS/iisnode) without 500 errors. Follow it line-for-line when spinning up new apps.

---

## What Fixed the 500 Errors (Summary)

1. **Dotenv** – Load in a file that runs **first** (`loadEnv.ts`), with the **exact pattern** below. Use normal `import dotenv` (so `npm install --production` on the server is required).
2. **process.env** – Use **dot notation only**: `process.env.PORT`, never `process.env['PORT']`.
3. **Port** – In `server.ts` always use: `const port = process.env.PORT || 3000`. Never set port to `undefined` in production.
4. **web.config** – Keep it **minimal**: only iisnode, handlers, and one rewrite to `dist/server.js`.
5. **On server** – Run `npm install --production` in the app root after upload, then restart IIS.

---

## 1. Project structure

```
your-app/
├── .env              # Local dev (never commit)
├── .env.prod         # Production values; deploy script copies to .env on server
├── .env.example      # Template (commit this)
├── src/
│   ├── loadEnv.ts    # MUST run first – loads .env
│   ├── server.ts     # Entry: imports loadEnv, then app; starts listen
│   ├── app.ts        # Express app
│   └── config/
│       └── env.ts    # Reads process.env only (dot notation)
├── scripts/
│   └── deploy-mochahost.ts
├── dist/             # Compiled output (npm run build)
├── web.config        # Minimal IIS/iisnode
├── package.json
└── tsconfig.json
```

---

## 2. Exact code

### 2.1 `src/loadEnv.ts` (run first; do not change the pattern)

```ts
import path from 'path';
import dotenv from 'dotenv';

// Exact Mochahost pattern – do not change
let dotenvResult: ReturnType<typeof dotenv.config> | null = null;
let envPath: string | null = null;

try {
  envPath = path.resolve(__dirname, '../.env');
  dotenvResult = dotenv.config({ path: envPath });
  console.log('Dotenv loaded successfully');
} catch (error) {
  console.error('Dotenv loading failed:', error);
}

console.log('Dotenv result:', !!dotenvResult);
```

- When run from `dist/loadEnv.js`, `__dirname` is `dist/`, so `../.env` is the project root. Correct.
- Use **normal** `import dotenv` so the package must be installed on the server.

### 2.2 `src/server.ts` (entry point)

```ts
import './loadEnv';
import { app } from './app';

// Mochahost: always use process.env.PORT || 3000 (dot notation). Never assign undefined.
const port = process.env.PORT || 3000;

app.listen(port, () => {
  const url = `http://localhost:${port}`;
  console.log(`Server running on port ${port}`);
  console.log(`Local: ${url}`);
  console.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
});
```

- **Port:** Always `process.env.PORT || 3000`. Never `process.env.NODE_ENV === 'production' ? undefined : process.env.PORT`.
- **Order:** Import `loadEnv` before `app` so `.env` is loaded before any code reads `process.env`.

### 2.3 `src/config/env.ts` (only reads process.env)

```ts
/**
 * Config reads process.env only. Use dot notation for Mochahost.
 * Dotenv is loaded in loadEnv.ts before this runs.
 */
const PORT = process.env.PORT ?? '3000';
const NODE_ENV = process.env.NODE_ENV ?? 'development';

export const config = {
  port: Number.parseInt(PORT, 10) || 3000,
  nodeEnv: NODE_ENV as 'development' | 'production' | 'test',
  isProduction: NODE_ENV === 'production',
};
```

- **Only dot notation:** `process.env.PORT`, `process.env.NODE_ENV`. No `process.env['PORT']`.

### 2.4 `src/app.ts` (Express app)

```ts
import express, { type Request, type Response } from 'express';
import { config } from './config/env';

const app = express();

app.use(express.json());

app.get('/', (_req: Request, res: Response): void => {
  res.json({ name: 'my-api', version: '0.1.0', endpoints: ['/health'] });
});

app.get('/health', (_req: Request, res: Response): void => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

app.use((_req: Request, res: Response): void => {
  res.status(404).json({ status: 'error', error: 'Not found' });
});

app.use((err: Error, _req: Request, res: Response): void => {
  console.error(err);
  res.status(500).json({ status: 'error', error: err.message ?? 'Unknown error' });
});

export { app };
```

- Import `config` from `./config/env` after dotenv has run (loadEnv is loaded in server before app).

### 2.5 `web.config` (minimal – do not add extra sections)

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <iisnode 
      nodeProcessCommandLine="C:\Program Files\nodejs\node.exe"
      loggingEnabled="true"
      devErrorsEnabled="true"
      />
    <handlers>
      <add name="iisnode" path="*.js" verb="*" modules="iisnode"/>
    </handlers>
    <rewrite>
      <rules>
        <rule name="MainApp" stopProcessing="true">
          <match url=".*" />
          <action type="Rewrite" url="dist/server.js"/>
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

- Do **not** add `<security>`, `<httpErrors>`, `<staticContent>`, or multiple rewrite rules.

---

## 3. Rules checklist

| Rule | Do | Don't |
|------|----|--------|
| Dotenv | Load in `loadEnv.ts` first; exact pattern with `let dotenvResult`, `let envPath`, try/catch, `path.resolve(__dirname, '../.env')` | Load in a file that runs after other imports; use wrong path |
| process.env | Use dot notation: `process.env.PORT`, `process.env.NODE_ENV` | Use bracket notation: `process.env['PORT']` |
| Port | `const port = process.env.PORT \|\| 3000` in server.ts | Set port to `undefined` in production; use config.port from a module that might run before dotenv |
| web.config | Single rewrite to `dist/server.js`; minimal iisnode | Add security, httpErrors, staticContent, multiple rules |
| .env | Keep in project root; deploy as .env from .env.prod | Put .env inside dist/ or commit .env |
| Server | Run `npm install --production` in app root after deploy | Start the app without node_modules |

---

## 4. package.json (minimum)

- **main:** `"dist/server.js"`
- **scripts:** `"build": "tsc"`, `"start": "node dist/server.js"`, `"deploy-mochahost": "ts-node scripts/deploy-mochahost.ts"`
- **dependencies:** Must include `dotenv` and `express` (so they are installed with `npm install --production`).

---

## 5. tsconfig.json (output to dist/)

- `"outDir": "./dist"`
- `"rootDir": "./src"`
- `"include": ["src"]`
- So entry is `dist/server.js`, and `__dirname` in `dist/loadEnv.js` is `dist/`, hence `../.env` = project root.

---

## 6. Deployment flow

1. **Local:** `npm run build` → `dist/` is created.
2. **Deploy script:** Builds, copies `src/`, `dist/`, `package.json`, `web.config`, and copies `.env.prod` → `.env` into a staging folder, then uploads via FTP.
3. **On server (Plesk/SSH):** In the app root (where `package.json` and `web.config` are), run:
   ```bash
   npm install --production
   ```
4. Restart the IIS application.
5. Test `https://your-domain/` and `https://your-domain/health`.

---

## 7. .env.example (template)

```env
NODE_ENV=development
PORT=3000

# For deploy-mochahost (use .env.prod with real values)
FTP_HOST=ftp.yourhost.com
FTP_USER=your_ftp_user
FTP_PASSWORD=your_ftp_password
FTP_PORT=21
FTP_SECURE=false
FTP_REMOTE_PATH=/
```

- Local: copy to `.env` and run the app.
- Production: use `.env.prod` with the same app vars (e.g. `NODE_ENV=production`, `PORT=...`) plus FTP vars; deploy script copies `.env.prod` to `.env` on the server.

---

Using this structure and exact code, you can spin off new Node TS web apps for Mochahost quickly and avoid the previous 500 and dotenv issues.
