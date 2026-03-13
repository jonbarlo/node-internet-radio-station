# Mochahost Node.js API Quickstart & Onboarding Guide

## 🚀 Quickstart for New APIs

1. **Clone the repo and install dependencies:**
   ```bash
   git clone <repo-url>
   cd <project>
   npm install
   ```
2. **Copy `.env.example` to `.env` in the project root.**
   - Fill in all required values (DB, JWT, etc).
3. **Develop in `src/`, build to `dist/`:**
   - All source code lives in `src/`.
   - Build with `npm run build` (outputs to `dist/`).
4. **Run locally:**
   ```bash
   npm run dev
   # or
   npm run dev:watch
   ```
5. **Deploy using the provided script:**
   ```bash
   npm run deploy:mochahost
   # Then, on the server (Plesk):
   npm install --production
   npm run build
   ```
6. **Test endpoints:**
   - `/` (root)
   - `/health`
   - `/auth/login` (get JWT)
   - All protected endpoints (use JWT)

---

## Project Structure

```
your-app/
├── .env                # Environment variables (never in dist/)
├── src/                # All TypeScript source code
│   ├── app.ts          # Main app entry
│   ├── api/            # Routers (auth, buckets, files, folders)
│   ├── middlewares/    # Auth, error handling, etc
│   ├── models/         # Sequelize models
│   └── ...
├── dist/               # Compiled JS (never edit)
├── package.json
├── tsconfig.json
├── web.config          # IIS/iisnode config
└── ...
```

---

## Environment Variables (`.env`)
- Always keep `.env` in the project root (never in `dist/`).
- Example:
  ```env
  NODE_ENV=production
  DB_HOST=...
  DB_NAME=...
  DB_USER=...
  DB_PASSWORD=...
  DB_PORT=1433
  JWT_SECRET=your-jwt-secret
  JWT_EXPIRES_IN=1h
  ```
- Never commit `.env` to version control.

---

## Environment Variable Loading
- In your code, always load `.env` from the project root:
  ```ts
  import dotenv from 'dotenv';
  import path from 'path';
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
  ```
- This works for both local dev and production (when running from `dist/`).
- **Never copy `.env` into `dist/`.**

---

## web.config for IIS/iisnode

### ⚠️ CRITICAL: Keep web.config MINIMAL

**Mochahost shared hosting is extremely sensitive to web.config complexity. Complex configurations will cause 500 Internal Server Error even with working code.**

### ✅ CORRECT (Minimal) web.config:
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

### ❌ AVOID (Complex) web.config:
- **DON'T** add `<security>` sections
- **DON'T** add `<httpErrors>` configuration
- **DON'T** add `<staticContent>` settings
- **DON'T** add complex `<iisnode>` parameters
- **DON'T** add multiple rewrite rules
- **DON'T** add verbose logging settings

### Why This Matters:
- Complex web.config sections require server-level permissions we don't have
- Additional settings can conflict with Mochahost's default IIS configuration
- The simpler the web.config, the more likely it is to work on shared hosting
- **If you get 500 errors with working code, simplify your web.config first**

### Key Rules:
1. **Only include essential iisnode parameters**
2. **Use simple rewrite rules**
3. **Avoid security and error handling sections**
4. **Test with minimal config first, then add complexity gradually**

---

## ⚠️ CRITICAL: Environment Variable Access Pattern

**Mochahost shared hosting has issues with bracket notation for environment variables.**

### ❌ WRONG (causes 500 errors):
```js
process.env['NODE_ENV']
process.env['PORT']
process.env['JWT_SECRET']
process.env['DATABASE_URL']
```

### ✅ CORRECT (works properly):
```js
process.env.NODE_ENV
process.env.PORT
process.env.JWT_SECRET
process.env.DATABASE_URL
```

### Why This Matters:
- **Bracket notation** (`process.env['VAR']`) can cause 500 Internal Server Error on Mochahost
- **Dot notation** (`process.env.VAR`) works reliably
- This applies to **all environment variable access** in your code
- **TypeScript** often uses bracket notation by default - be careful!

### Fix Your Code:
Search and replace all instances of `process.env['` with `process.env.` in your codebase.

---

## ⚠️ CRITICAL: Error Handling for dotenv Loading

**Mochahost shared hosting requires error handling around dotenv loading.**

### ❌ WRONG (causes 500 errors):
```js
dotenv.config({ path: path.resolve(__dirname, '../.env') });
```

### ✅ CORRECT (works properly):
```js
try {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
  console.log('Environment variables loaded successfully');
} catch (error) {
  console.error('Failed to load environment variables:', error);
}
```

### Why This Matters:
- **Without error handling**, dotenv loading failures cause 500 Internal Server Error
- **With error handling**, the application continues running even if .env loading fails
- This applies to **all dotenv.config() calls** in your codebase
- **Always wrap dotenv loading in try/catch blocks**

### Fix Your Code:
Add error handling around all `dotenv.config()` calls in your config files.

---

## ⚠️ CRITICAL: Exact Dotenv Loading Pattern for Mochahost

**Mochahost shared hosting requires a specific dotenv loading pattern to work reliably.**

### ❌ WRONG (causes 500 errors):
```js
// Simple dotenv loading
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Or with basic error handling
try {
  dotenv.config({ path: path.resolve(__dirname, '.env') });
} catch (error) {
  console.error('Failed to load environment variables:', error);
}
```

### ✅ CORRECT (works reliably):
```js
// Exact pattern that works on Mochahost
let dotenvResult = null;
let envPath = null;

try {
  envPath = path.resolve(__dirname, '.env');
  dotenvResult = dotenv.config({ path: envPath });
  console.log('Dotenv loaded successfully');
} catch (error) {
  console.error('Dotenv loading failed:', error);
}
```

### Why This Pattern Works:
- **Variable declarations** (`let dotenvResult = null; let envPath = null;`) help with hoisting
- **Explicit path assignment** (`envPath = path.resolve(__dirname, '.env')`) ensures proper resolution
- **Result capture** (`dotenvResult = dotenv.config(...)`) provides debugging info
- **Consistent error handling** prevents silent failures

### Port Handling:
```js
// Always use this pattern for port handling
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

**CRITICAL: Never assign ports in production on Mochahost!**
- **IIS/iisnode automatically manages ports** in production
- **Always use**: `const port = process.env.PORT || 3000;`
- **Never use**: `const port = process.env.NODE_ENV === 'production' ? undefined : process.env.PORT;`
- **Let IIS handle port assignment** - don't interfere with it

### Test Your Setup:
Create a test endpoint to verify dotenv loading:
```js
app.get('/test', (req, res) => {
  res.json({
    dotenvLoaded: !!dotenvResult,
    envPath: envPath,
    dotenvError: dotenvResult?.error || null,
    nodeEnv: process.env.NODE_ENV,
    hasJwtSecret: !!process.env.JWT_SECRET,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    timestamp: new Date().toISOString()
  });
});
```

---

## TypeScript Build & tsconfig.json
- Always output your main app entry file to `dist/` (not `dist/src/`).
- Example `tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "target": "es2019",
      "module": "commonjs",
      "outDir": "./dist",
      "rootDir": "./src",
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true
    },
    "include": ["src"]
  }
  ```
- After building, your entry should be `dist/index.js` or `dist/app.js`.

---

## CRITICAL: Use a Single Shared Sequelize Instance
- **Never create multiple Sequelize instances.**
- Initialize Sequelize once in your main app (e.g., `app.ts`):
  ```ts
  import { Sequelize } from 'sequelize';
  import initializeModels from './models';
  const sequelize = new Sequelize(/* ...config... */);
  const db = initializeModels(sequelize);
  ```
- Pass the initialized `db` to all routers, middleware, and scripts:
  ```ts
  import createAuthRouter from './api/auth';
  app.use('/auth', createAuthRouter(db));
  ```
- For scripts, initialize `sequelize` and `db` at the top before using any models.
- **Symptoms of the anti-pattern:**
  - HTML 500 errors from IIS (not JSON), even when other endpoints work.
  - Fatal startup crashes not caught by Express error handlers.
  - Inconsistent database state or missing models in some routes.

---

## JWT Authentication
- Always use a consistent JWT payload (e.g., `{ userId, username }`).
- Middleware should extract `userId` from the token and look up the user in the DB.
- Example:
  ```ts
  // Signing
  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
  // Verifying
  const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
  const user = await db.User.findByPk(payload.userId);
  ```
- If the payload and middleware are mismatched, protected endpoints will always 401.

---

## Error Handling & Debugging
- **Never throw exceptions at the top level in routers or middleware.** Always return errors as JSON.
- Add a global error handler at the end of your app:
  ```ts
  app.use((err, req, res, next) => {
    res.status(500).json({ status: 'error', error: err.message || 'Unknown error' });
  });
  ```
- For fatal startup errors (e.g., router import fails), wrap router mounting in a try/catch and expose the error in a debug endpoint or global handler.
- Remove debug code before going live.

---

## Deployment Steps (Summary)
1. **Build:** `npm run build`
2. **Deploy:** `npm run deploy:mochahost`
3. **On server:** `npm install --production && npm run build`
4. **Restart IIS app in Plesk**
5. **Test all endpoints**

---

## Troubleshooting Checklist
- `.env` is in the project root (not in `dist/`)
- Main entry file is in `dist/` and matches `web.config`
- **web.config is MINIMAL (no complex sections)**
- Only one Sequelize instance is used
- JWT payload and middleware are consistent
- All endpoints return JSON errors (not HTML 500)
- Remove debug output before production

### 500 Internal Server Error? Check This First:
1. **Use exact dotenv loading pattern** - `let dotenvResult = null; let envPath = null;` with try/catch
2. **Fix environment variable access** - use `process.env.VAR` not `process.env['VAR']`
3. **Add error handling for dotenv loading** - wrap `dotenv.config()` in `try/catch`
4. **Fix port handling** - use `const port = process.env.PORT || 3000;` (never assign undefined in production)
5. **Simplify web.config** - remove all non-essential sections
6. **Test with minimal web.config** - only iisnode, handlers, and basic rewrite
7. **Verify file paths** - ensure web.config points to correct entry file
8. **Check file permissions** - ensure files are readable by IIS

## ⚠️ CRITICAL: The Root Cause of 500 Errors

**After extensive debugging, the root cause of persistent 500 Internal Server Error on Mochahost was:**

### The Problem:
The main API files (`src/app.ts`, `src/server.ts`, `src/config/*.ts`) were using **inconsistent dotenv loading patterns** compared to the working test files.

### The Solution:
**ALL dotenv loading must use the EXACT pattern:**
```js
// Test dotenv loading with different path patterns
let dotenvResult = null;
let envPath = null;

try {
  // Try the Mochahost pattern: __dirname + '../.env'
  envPath = path.resolve(__dirname, '../.env');
  dotenvResult = dotenv.config({ path: envPath });
  console.log('Dotenv loaded successfully');
} catch (error) {
  console.error('Dotenv loading failed:', error);
}

// Use dotenvResult to avoid TS6133 error
console.log('Dotenv result:', !!dotenvResult);
```

### Why This Matters:
- **Variable declarations** (`let dotenvResult = null; let envPath = null;`) help with hoisting
- **Explicit path assignment** (`envPath = path.resolve(__dirname, '../.env')`) ensures proper resolution
- **Result capture** (`dotenvResult = dotenv.config(...)`) provides debugging info
- **Using the variable** (`console.log('Dotenv result:', !!dotenvResult);`) prevents TypeScript unused variable errors
- **Consistent error handling** prevents silent failures

### Files That Must Use This Pattern:
- `src/app.ts`
- `src/config/index.ts`
- `src/config/database.ts`
- `src/config/email.ts`
- `prisma/seed.ts`
- Any file that loads environment variables

### Port Handling:
```js
// Always use this pattern for port handling
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

**This exact pattern was tested and confirmed working on Mochahost shared hosting.**

---

## Security Notes
- Never commit `.env` to version control.
- Use strong, unique secrets for DB and JWT.
- Rotate secrets regularly.

---

**This guide is designed for fast onboarding and reliable deployment of Node.js APIs to Mochahost. Follow it step-by-step to avoid common pitfalls and get your API live quickly.**
