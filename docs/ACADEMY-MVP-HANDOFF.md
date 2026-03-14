# Online Academy MVP – Complete Handoff (Backend, Frontend, Mobile)

**Purpose:** This is the only document the implementing AI agents will have. It contains all explanations, code samples, commands, and patterns. Do not refer to other files or repos; everything needed is below.

---

## Part A: Backend Foundation (Node.js + TypeScript + Express)

### A.1 Why This Structure

The backend runs on **shared Windows hosting (IIS/iisnode, e.g. Mochahost)**. That environment has strict requirements:

- Environment variables must be loaded from a file (`.env`) **before** any other code runs, using a **fixed path** that works when the app runs from `dist/` (compiled output). Using `process.env['PORT']` (bracket notation) can cause 500 errors on IIS; only **dot notation** (`process.env.PORT`) must be used.
- The web server (IIS) rewrites all requests to a single Node entry file (`dist/server.js`). So the app has **one entry point** that loads env first, then the Express app, then calls `listen(port)`.
- Port must never be `undefined` in production; use `process.env.PORT || 3000` so IIS can inject the port.

There is **no VPS** for video encoding. **HLS (audio/video streaming) is generated on a developer’s desktop** with ffmpeg, then **uploaded via FTP** to the same host that runs the API. The deploy script builds the app, copies files to a staging folder, and uploads via FTP. On the server you run `npm install --production` and restart IIS.

---

### A.2 Project Layout (Backend)

Create the backend with this structure. Every path is relative to the backend root (where `package.json` and `web.config` live).

```
backend/
├── .env                 # Local dev; never commit (create from .env.example)
├── .env.prod            # Production + FTP; never commit
├── .env.example         # Template; commit this
├── src/
│   ├── loadEnv.ts       # Must run first: loads .env
│   ├── server.ts        # Entry: imports loadEnv, then app; starts listen
│   ├── app.ts           # Express app (no listen here)
│   ├── config/
│   │   └── env.ts       # Reads process.env only (dot notation)
│   ├── modules/         # One folder per feature (auth, courses, lessons, etc.)
│   │   └── streams/     # Example feature
│   │       └── streams.routes.ts
│   ├── middlewares/
│   └── types/
├── scripts/
│   ├── generate-hls.ts  # Generates HLS from MP3/video via ffmpeg
│   └── deploy-mochahost.ts  # Build + FTP upload
├── public/              # Static files (e.g. player page)
├── dist/                # Compiled output (tsc); do not edit
├── channels/            # HLS output folders (playlist.m3u8 + .ts); can be gitignored
├── samples/             # Source MP3/video before HLS; gitignored
├── package.json
├── tsconfig.json
└── web.config           # IIS: rewrite all to dist/server.js
```

---

### A.3 Load Environment First: `src/loadEnv.ts`

This file **must** be imported before anything that reads `process.env`. When the app runs from `dist/server.js`, `__dirname` is `dist/`, so `../.env` is the project root. Use this **exact** pattern (try/catch, explicit path) so it works on IIS.

```typescript
import path from 'path';
import dotenv from 'dotenv';

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

---

### A.4 Entry Point: `src/server.ts`

Import `loadEnv` first so `.env` is loaded. Then import the app and listen. **Always** set port with `process.env.PORT || 3000` (dot notation; never leave port undefined in production).

```typescript
import './loadEnv';
import { app } from './app';

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
});
```

---

### A.5 Config: `src/config/env.ts`

Config **only** reads `process.env`. Use **dot notation** everywhere: `process.env.PORT`, `process.env.NODE_ENV`. Never use `process.env['PORT']`. This module runs after loadEnv (because server imports loadEnv then app, and app imports config).

```typescript
const PORT = process.env.PORT ?? '3000';
const NODE_ENV = process.env.NODE_ENV ?? 'development';

export const config = {
  port: Number.parseInt(PORT, 10) || 3000,
  nodeEnv: NODE_ENV as 'development' | 'production' | 'test',
  isProduction: NODE_ENV === 'production',
};
```

---

### A.6 Express App: `src/app.ts`

- Use `express.json()` for JSON bodies.
- Mount feature routers (e.g. `app.use('/streams', streamsRouter)`).
- For serving static files (e.g. HLS), resolve paths from `__dirname` so it works when the process cwd is not the app root (e.g. on IIS). Example: `path.resolve(__dirname, '..', 'public')` for `public/`, and for HLS folders use a config that resolves from app root (e.g. `path.resolve(__dirname, '..', '..')` for app root when this file is at `dist/app.js`).
- **404:** Catch-all route that returns JSON: `{ status: 'error', error: 'Not found' }` with status 404.
- **500:** Global error handler (four-arg middleware) that logs the error and returns JSON: `{ status: 'error', error: err.message ?? 'Unknown error' }` with status 500. Never let route handlers throw uncaught; use try/catch or next(err) so the global handler runs.

Example shape:

```typescript
import path from 'path';
import express, { type Request, type Response } from 'express';
import { config } from './config/env';
// import { streamsRouter, mountStreamStatic } from './modules/streams/streams.routes';

const app = express();

app.use(express.json());

// Example: static files from public/
const publicDir = path.resolve(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Example: mount feature router and static HLS
// mountStreamStatic(app);
// app.use('/streams', streamsRouter);

app.get('/', (_req: Request, res: Response): void => {
  res.json({
    name: 'academy-api',
    version: '0.1.0',
    endpoints: ['/health', '/auth', '/courses', '/enrollments', '/progress'],
  });
});

app.get('/health', (_req: Request, res: Response): void => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// 404: must be after all routes
app.use((_req: Request, res: Response): void => {
  res.status(404).json({ status: 'error', error: 'Not found' });
});

// 500: global error handler (four arguments)
app.use((err: Error, _req: Request, res: Response): void => {
  console.error(err);
  res.status(500).json({ status: 'error', error: err.message ?? 'Unknown error' });
});

export { app };
```

---

### A.7 Feature Module Pattern: Router + Optional Static Mount

Put each feature under `src/modules/<feature>/`. Export a router and, if the feature serves files (e.g. HLS), a function that mounts `express.static` for each logical “channel” or “course/lesson” folder.

**Router example** – list “streams” (channels) with full playlist URL. Use `req.protocol` and `req.get('host')` to build absolute URLs for the client.

```typescript
// src/modules/streams/streams.routes.ts
import { Router, type Request, type Response } from 'express';
import express from 'express';
import { channels, getChannelPlaylistPath } from '../../config/channels';  // channels = list of { id, name, path }

const router = Router();

router.get('/', (req: Request, res: Response): void => {
  const baseUrl = `${req.protocol}://${req.get('host') ?? ''}`;
  const list = channels.map((ch) => {
    const playlistName = getChannelPlaylistPath(ch);  // 'playlist.m3u8' or null
    const playlistUrl = playlistName
      ? `${baseUrl}/streams/${ch.id}/${playlistName}`
      : null;
    return {
      id: ch.id,
      name: ch.name,
      playlistUrl,
      hasPlaylist: !!playlistName,
    };
  });
  res.json({ streams: list });
});

export { router as streamsRouter };

export function mountStreamStatic(app: express.Express): void {
  for (const ch of channels) {
    app.use(
      `/streams/${ch.id}`,
      express.static(ch.path, { index: false, maxAge: '1h' })
    );
  }
}
```

Config for channels: an array of `{ id, name, path }` where `path` is resolved from the **app root** using `path.resolve(APP_ROOT, relativePath)`. App root when running from `dist/` is `path.resolve(__dirname, '..', '..')` in a file at `dist/config/channels.js`. So in `src/config/channels.ts` you would set `const APP_ROOT = path.resolve(__dirname, '..', '..');` (because that file compiles to `dist/config/channels.js`).

---

### A.8 API Conventions

- **REST:** Use standard HTTP methods and resource paths (e.g. `GET /courses`, `GET /courses/:id`, `POST /courses`, `PATCH /courses/:id`).
- **JSON:** All responses are JSON. Request bodies for create/update are JSON.
- **Error shape:** Always `{ status: 'error', error: string }` for 4xx/5xx. Use consistent field names so the frontend can show `error` to the user.
- **No HTML errors:** Do not return HTML for errors; return JSON only.

---

### A.9 package.json (Minimum)

- **main:** `"dist/server.js"`
- **scripts:**
  - `"build": "tsc"`
  - `"start": "node dist/server.js"`
  - `"dev": "ts-node-dev --respawn --transpile-only src/server.ts"`
  - `"deploy-mochahost": "ts-node scripts/deploy-mochahost.ts"`
  - `"generate-hls": "ts-node scripts/generate-hls.ts"`
- **dependencies:** Must include `dotenv` and `express` (needed in production). For academy add Prisma, bcrypt (or similar), jsonwebtoken, etc.
- **devDependencies:** typescript, @types/node, @types/express, ts-node, ts-node-dev, basic-ftp (for deploy script).

---

### A.10 tsconfig.json

Output to `dist/` with source in `src/`. So that `__dirname` in compiled code is `dist/` (and in subfolders like `dist/config/`), set:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

---

### A.11 web.config (IIS / iisnode)

Keep this **minimal**. Do not add extra sections (security, httpErrors, staticContent, or multiple rewrite rules). All requests are rewritten to `dist/server.js`.

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

---

### A.12 .env.example

Template for local and production. Never commit `.env` or `.env.prod`. On the server, the deploy script copies `.env.prod` to `.env`.

```env
NODE_ENV=development
PORT=3000

# Database (MS SQL Server) – Prisma connection string
DATABASE_URL="sqlserver://HOST:1433;database=DBNAME;user=USER;password=PASS;encrypt=true;trustServerCertificate=true"

# JWT (change in production)
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_EXPIRES_IN=7d

# FTP for deploy script (used only when running deploy-mochahost)
FTP_HOST=ftp.example.com
FTP_USER=user
FTP_PASSWORD=password
FTP_PORT=21
FTP_SECURE=false
FTP_REMOTE_PATH=/
```

---

## Part B: FFmpeg and HLS Generation (Local Desktop)

### B.1 Why HLS Is Generated Locally

The production server is shared hosting (e.g. Mochahost). It does not run ffmpeg or heavy encoding. So:

1. **Source media** (MP3, MP4, etc.) stay on the developer’s machine in folders like `samples/course-1/lesson-1/`.
2. **HLS** (playlist.m3u8 + .ts segments) is generated **on the desktop** with ffmpeg.
3. The generated HLS folder is **uploaded via FTP** to the server (e.g. into `channels/course-1/lesson-1/` or `media/courses/:id/lessons/:lessonId/`). The backend then serves these files with Express static middleware, **after** checking auth and enrollment.

---

### B.2 Installing FFmpeg on Windows (Full Steps)

1. **Install 7-Zip** from https://www.7-zip.org/ so you can extract the ffmpeg archive.
2. **Download FFmpeg:** Go to https://www.gyan.dev/ffmpeg/builds/ and download the **release builds** (e.g. `ffmpeg-release-full.7z`). For Windows 7/8 use the “essentials” build if the full build does not run.
3. **Extract:** Right-click the downloaded `.7z` file → 7-Zip → Extract Here. Rename the extracted folder to `FFmpeg`.
4. **Move folder:** Move the `FFmpeg` folder to the root of your main drive (e.g. `C:\FFmpeg`). The bin folder is then `C:\FFmpeg\bin`.
5. **Add to system PATH:** Open **Command Prompt as Administrator** (search “cmd” → right-click Command Prompt → Run as administrator). Run exactly:
   ```batch
   setx /m PATH "C:\FFmpeg\bin;%PATH%"
   ```
   If you used a different path (e.g. `D:\FFmpeg\bin`), use that instead of `C:\FFmpeg\bin`.
6. **Close** that Command Prompt window. **Open a new** Command Prompt (normal or admin) and run:
   ```batch
   ffmpeg -version
   ```
   If you see version information, FFmpeg is ready. If you get “not recognized,” open a new terminal (PATH changes apply only to new sessions).

---

### B.3 Generate HLS from a Single Audio/Video File

From the folder that will hold the HLS output (e.g. `channels/course-1/lesson-1/`), run ffmpeg. Example for a single MP3 (audio only, 2 channels, AAC, 10-second segments):

```bash
ffmpeg -y -i "path/to/your_audio.mp3" -vn -ac 2 -acodec aac -f segment -segment_format mpegts -segment_time 10 -segment_list playlist.m3u8 -segment_list_type m3u8 segment%05d.ts
```

This creates `playlist.m3u8` and `segment00000.ts`, `segment00001.ts`, etc. For **video**, remove the `-vn` flag and add video codec (e.g. copy or re-encode). Example with video copy:

```bash
ffmpeg -y -i "path/to/your_video.mp4" -c copy -f segment -segment_format mpegts -segment_time 10 -segment_list playlist.m3u8 -segment_list_type m3u8 segment%05d.ts
```

---

### B.4 Generate HLS from Multiple Files (Concat Then Segment)

When one “lesson” is multiple MP3s (or videos) that must play in order:

1. Create a text file (e.g. `list.txt`) in the output folder with one line per file:
   ```
   file 'C:/path/to/track1.mp3'
   file 'C:/path/to/track2.mp3'
   file 'C:/path/to/track3.mp3'
   ```
   Use forward slashes and quote paths that contain spaces.

2. Run ffmpeg with concat demuxer:
   ```bash
   ffmpeg -y -f concat -safe 0 -i list.txt -vn -ac 2 -acodec aac -f segment -segment_format mpegts -segment_time 10 -segment_list playlist.m3u8 -segment_list_type m3u8 segment%05d.ts
   ```

The Node script `generate-hls.ts` (see below) automates building this list from a folder of MP3s and running the equivalent command.

---

### B.5 Node Script: generate-hls.ts (Concept)

The script:

1. Accepts two arguments: channel (or course/lesson) id and input path (file or folder).
2. Resolves the **output directory** (e.g. `channels/channel-1` or `media/courses/:courseId/lessons/:lessonId`).
3. If input is a **folder:** list all `.mp3`/`.m4a` (or `.mp4`) files, sort by name, write a concat list file, then run ffmpeg with `-f concat -safe 0 -i list.txt` and the same segment options.
4. If input is a **file:** run ffmpeg with `-i "<path>"` and the same segment options.
5. Output: `playlist.m3u8` and `segment00000.ts`, … in the output directory.

Use `child_process.execSync(cmd, { stdio: 'inherit' })` to run ffmpeg. Build the command string with the correct paths. On Windows, paths in the concat file must use forward slashes. Example ffmpeg command (single output dir):

```ts
const segmentList = path.join(outDir, 'playlist.m3u8');
const segmentPattern = path.join(outDir, 'segment%05d.ts');
const cmd = `ffmpeg -y ${inputArg} -vn -ac 2 -acodec aac -f segment -segment_format mpegts -segment_time 10 -segment_list "${segmentList}" -segment_list_type m3u8 "${segmentPattern}"`;
execSync(cmd, { stdio: 'inherit' });
```

Invoke from backend root:

```bash
npm run generate-hls -- channel-1 ./samples/channel-1
npm run generate-hls -- course-1-lesson-1 ./samples/courses/course-1/lesson-1
```

For the academy, extend the script to support video (drop `-vn`, add video codec) and to accept course/lesson ids so output goes to the right folder (e.g. `media/courses/:courseId/lessons/:lessonId/`).

---

### B.6 Makefile Targets (Optional)

From the backend root, you can wrap the npm script in a Makefile so the operator runs:

```bash
make generate-hls CHANNEL=channel-1 INPUT=./samples/channel-1
```

Makefile example:

```makefile
generate-hls:
ifndef CHANNEL
	$(error CHANNEL is required. Use CHANNEL=channel-1 or CHANNEL=course-1-lesson-1)
endif
ifndef INPUT
	$(error INPUT is required. Use INPUT=./samples/channel-1)
endif
	npm run generate-hls -- $(CHANNEL) $(INPUT)
```

---

## Part C: FTP Deploy Script (Concept and Flow)

### C.1 Why FTP

The host (e.g. Mochahost) does not offer Git or SSH-based deploy. You build locally and upload via FTP. The script:

1. Reads FTP credentials from `.env.prod` (FTP_HOST, FTP_USER, FTP_PASSWORD, FTP_PORT, FTP_SECURE, FTP_REMOTE_PATH).
2. Runs `npm run build` so `dist/` is up to date.
3. Creates a staging directory (e.g. `deployment-ftp/`).
4. Copies into it: `package.json`, `package-lock.json`, `web.config`, `tsconfig.json`, `src/`, `dist/`, `public/`. Optionally copy `channels/` or `media/` if you want to upload HLS in the same run. Copy `.env.prod` as `.env` into the staging dir (so the server has `.env`).
5. Uploads the staging directory to the FTP server under `FTP_REMOTE_PATH` (e.g. `/` or `/httpdocs`). Use the `basic-ftp` package: create a client, `client.access(config)`, then recursively upload files (e.g. `client.uploadFrom(localPath, remotePath)` for each file). Ensure directories are created on the server (e.g. `ensureDir`).
6. After upload, the operator must **on the server** run `npm install --production` in the app root and restart the IIS application.

Do **not** upload `node_modules`, `.env` from local (only the one copied from `.env.prod`), or the staging folder itself to the repo. Exclude deploy scripts from the copied `src/` if you do not want them on the server (e.g. `scripts/deploy-mochahost.ts`).

---

### C.2 .env.prod Contents (FTP + App)

Same as `.env.example` but with real values. Include:

- NODE_ENV=production
- PORT=3000 (or leave empty if IIS sets it)
- DATABASE_URL=...
- JWT_SECRET=...
- FTP_HOST=...
- FTP_USER=...
- FTP_PASSWORD=...
- FTP_PORT=21
- FTP_SECURE=false
- FTP_REMOTE_PATH=/

---

## Part D: Online Academy MVP – Scope and Implementation

### D.1 Roles

- **Student:** Browse course catalog, enroll in courses, watch/listen to lessons (HLS), see progress (e.g. X of Y lessons completed, last position for resume). Optionally take quizzes or submit assignments.
- **Professor:** Create and manage **own** courses and lessons; upload source audio/video (or run generate-hls locally and upload HLS via FTP); view enrollments and basic stats for their courses.
- **Admin:** Manage users (list, change role); optionally moderate courses.

---

### D.2 Core Data (MS SQL + Prisma)

- **User:** id, email, passwordHash, role (`student` | `professor` | `admin`), name, createdAt, updatedAt.
- **Course:** id, professorId (FK User), **title** (Spanish, default), **titleEn** (optional), **description** (Spanish), **descriptionEn** (optional), slug, imageUrl (optional), **difficulty** (optional), published (boolean), sortOrder, createdAt, updatedAt. **Courses are multi-language:** API returns title/description in requested locale (es | en); **default locale is Spanish (es)**.
- **Lesson:** id, courseId (FK Course), **title** (Spanish), **titleEn** (optional), **description** (Spanish), **descriptionEn** (optional), sortOrder, durationSeconds (optional), **mediaType** (`'audio'` | `'video'`), hlsPath, createdAt, updatedAt. **Lessons are multi-language** in the same way as courses.
- **Enrollment:** id, userId (FK User), courseId (FK Course), enrolledAt, **score** (optional: number or percentage for final course grade; can be set manually by professor or computed from quiz/lesson completion). Unique (userId, courseId).
- **Progress:** id, userId, lessonId (FK Lesson), completed (boolean), lastPositionSeconds (optional), lastAccessedAt. Unique (userId, lessonId).
- **CourseAttachment:** id, courseId (FK Course), **title** (Spanish), **titleEn** (optional), **filePath** (relative path to file, e.g. `courses/:courseId/attachments/slides.pdf`), **type** (`'pdf'` | `'image'`), sortOrder, createdAt. Professors add attachments (PDFs, images) to reinforce the course; only enrolled students (and professor/admin) can download/view. Files are stored on disk (upload via API or FTP) and served with same access control as HLS.

Optional: Quiz, Question, Answer, Submission tables for simple assessments; omit or keep minimal for MVP.

**Prisma schema (conceptual):**

```prisma
datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  role         String   // 'student' | 'professor' | 'admin'
  name         String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  courses      Course[] @relation("ProfessorCourses")
  enrollments  Enrollment[]
  progress     Progress[]
}

model Academy {
  id           String   @id @default(uuid())
  slug         String   @unique   // e.g. 'career', 'investing'
  name         String
  primaryColor String?
  logoUrl      String?
  active       Boolean  @default(true)
  sortOrder    Int      @default(0)
  courses      Course[]
}

model Course {
  id          String    @id @default(uuid())
  academyId   String
  academy     Academy   @relation(fields: [academyId], references: [id])
  professorId String
  professor   User      @relation("ProfessorCourses", fields: [professorId], references: [id])
  title       String    // Spanish (default locale)
  titleEn     String?   // English – optional; API returns this when locale=en
  description String?
  descriptionEn String?
  slug        String    // unique per academy (@@unique([academyId, slug]))
  imageUrl    String?
  difficulty  String?   // 'beginner' | 'intermediate' | 'advanced'
  published   Boolean   @default(false)
  sortOrder   Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  lessons     Lesson[]
  enrollments Enrollment[]
  attachments CourseAttachment[]
}

model CourseAttachment {
  id        String   @id @default(uuid())
  courseId  String
  course    Course   @relation(fields: [courseId], references: [id])
  title     String   // Spanish (display name)
  titleEn   String?
  filePath  String   // relative path, e.g. courses/:courseId/attachments/slides.pdf
  type      String   // 'pdf' | 'image'
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
}

model Lesson {
  id             String   @id @default(uuid())
  courseId       String
  course         Course   @relation(fields: [courseId], references: [id])
  title          String   // Spanish (default)
  titleEn        String?
  description    String?
  descriptionEn  String?
  sortOrder      Int      @default(0)
  durationSeconds Int?
  mediaType      String   // 'audio' | 'video'
  hlsPath        String   // e.g. 'courses/courseId/lessons/lessonId'
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  progress       Progress[]
}

model Enrollment {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  courseId  String
  course    Course   @relation(fields: [courseId], references: [id])
  enrolledAt DateTime @default(now())
  score     Float?   // optional: final course grade (e.g. 0–100 or 0–1); set by professor or computed from quizzes
  @@unique([userId, courseId])
}

model Progress {
  id                String   @id @default(uuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id])
  lessonId          String
  lesson            Lesson   @relation(fields: [lessonId], references: [id])
  completed         Boolean  @default(false)
  lastPositionSeconds Int?
  lastAccessedAt    DateTime @updatedAt
  @@unique([userId, lessonId])
}
```

Use a **single PrismaClient** instance (e.g. in `src/lib/prisma.ts` or `src/config/prisma.ts`) and import it wherever you need the DB. Do not create a new client per request.

---

### D.3 Authentication (JWT)

- **Register:** `POST /auth/register` body: `{ email, password, name?, role? }`. Hash password (e.g. bcrypt), create User. For MVP, only admin might set role to professor; students self-register with role `student`. Return: `{ token, user: { id, email, role, name } }`.
- **Login:** `POST /auth/login` body: `{ email, password }`. Verify password, issue JWT. Return same shape: `{ token, user }`.
- **Token:** Include in response a JWT signed with JWT_SECRET. Payload: `{ sub: userId, role, iat, exp }`. Expiry e.g. 7 days (JWT_EXPIRES_IN=7d).
- **Protected routes:** Middleware that reads `Authorization: Bearer <token>`, verifies JWT, attaches `req.user = { id, role }`. If missing or invalid, return 401 JSON: `{ status: 'error', error: 'Unauthorized' }`.
- **Role checks:** Middleware or inline checks: e.g. only professor can create/edit their courses; only admin can change user roles; only enrolled student (or professor/admin) can get lesson playback URL.

---

### D.4 Locale (Multi-language)

- **Supported locales:** `es` (Spanish, **default**), `en` (English).
- **Backend:** Every endpoint that returns course or lesson content (catalog, course detail, lessons list, enrollments with course info) must accept a **locale** and return translated text:
  - **Query:** `?locale=es` or `?locale=en`.
  - **Or header:** `Accept-Language: es` or `Accept-Language: en` (or `en, es`; use first supported).
  - **Default:** If neither is provided, use `es`. Resolve locale once per request (e.g. middleware that sets `req.locale = 'es' | 'en'`).
- **Response rule:** For each translatable field (title, description), return the value for the requested locale. If the requested locale is `en` and the English field is null/empty, **fallback to Spanish**. Example: `title: locale === 'en' && course.titleEn ? course.titleEn : course.title`.
- **Create/update:** POST/PATCH for courses and lessons accept both languages: `title`, `titleEn`, `description`, `descriptionEn`. At least `title` (Spanish) is required for courses and lessons.

---

### D.5 API Endpoints (Detailed)

**Base path:** Mount all API routes under `/api/v1/` (e.g. `app.use('/api/v1', apiRouter)`). So the full path for login is `POST /api/v1/auth/login`. This allows future breaking changes under `/api/v2/` without breaking existing clients (see Part G.1).

**Auth**

- `POST /auth/register` – Body: `{ email, password, name? }`. Returns `{ token, user }`.
- `POST /auth/login` – Body: `{ email, password }`. Returns `{ token, user }`.

**Current user**

- `GET /users/me` – Requires auth. Returns `{ id, email, role, name }`.
- `PATCH /users/me` – Body: `{ name? }`. Update profile.

**Courses (catalog and CRUD)**

- `GET /courses` – Public. List published courses. Query: `?professorId=`, `?search=`, `?difficulty=...`, **`?locale=es|en`** (default es). Returns `{ courses: [{ id, title, slug, description, imageUrl, difficulty, professorId, lessonCount }] }` with **title/description in the requested locale** (fallback to Spanish if en missing).
- `GET /courses/:id` – Public. Query **`?locale=es|en`**. Course detail with lessons and **attachments**; **title/description for course and each lesson in requested locale**. Returns `{ course: { ... }, lessons: [...], attachments: [{ id, title, filePath, type, sortOrder }] }` with attachment titles in requested locale. Attachment **filePath** is relative; client gets download URL from a separate endpoint (see Attachments below) so access is checked.
- `POST /courses` – Professor only. Body: `{ title, titleEn?, description?, descriptionEn?, slug, imageUrl?, difficulty?, published? }`. **title** (Spanish) required. Returns created course.
- `PATCH /courses/:id` – Professor only (own course). Body: same fields (title, titleEn, description, descriptionEn, slug, imageUrl, difficulty, published). **No media here** – media is per lesson. Returns updated course.
- `GET /courses/my` – Professor only. Query **`?locale=es|en`**. Returns professor’s courses with localized title/description.

**Lessons**

- `GET /courses/:id/lessons` – Public or enrolled. Query **`?locale=es|en`**. Returns `{ lessons: [{ id, title, sortOrder, durationSeconds, mediaType }] }` with **title/description in requested locale**.
- `POST /courses/:id/lessons` – Professor only. Body: `{ title, titleEn?, description?, descriptionEn?, sortOrder?, mediaType, hlsPath }`. **title** (Spanish) required. Returns created lesson.
- `PATCH /courses/:id/lessons/:lessonId` – Professor only. Body: same fields (title, titleEn, description, descriptionEn, sortOrder, **mediaType**, **hlsPath**). **Media is editable here:** professor can set or change `hlsPath` (folder where HLS was uploaded) and `mediaType` (audio | video) when creating or updating a lesson. Returns updated lesson.

**Course attachments (PDFs, images – reinforce course)**

- `GET /courses/:id/attachments` – Public (metadata only) or with auth. Query **`?locale=es|en`**. Returns `{ attachments: [{ id, title, type, sortOrder }] }` (no filePath in list for security; client requests download URL per attachment). Or include a **downloadUrl** that points to a protected route (see below).
- `GET /courses/:id/attachments/:attachmentId/download` – Auth. If user is not enrolled (and not professor of this course and not admin), return 403. Otherwise return a **URL** to the file (e.g. signed or a path that the backend serves with the same `/media/*` middleware that checks auth + enrollment), or **redirect** to that URL. File is stored under the same media root (e.g. `media/courses/:courseId/attachments/:filename`). Students use this to view/download PDFs and images.
- `POST /courses/:id/attachments` – Professor only. Body: `{ title, titleEn?, filePath, type }`. **type** is `'pdf'` or `'image'`. **filePath** is the relative path where the file was uploaded (e.g. `courses/courseId/attachments/notes.pdf`). Professors upload files via FTP to that path, or (if implemented) via multipart upload; then create the attachment record with this endpoint. Returns created attachment.
- `PATCH /courses/:id/attachments/:attachmentId` – Professor only. Body: `{ title?, titleEn?, filePath?, type?, sortOrder? }`. Returns updated attachment.
- `DELETE /courses/:id/attachments/:attachmentId` – Professor only. Deletes the attachment record (optionally leave the file on disk or remove it in a later cleanup). Returns 204.

**Serving attachment files:** Use the same pattern as HLS: a route like `GET /media/*` that resolves the path, checks auth and enrollment (or professor/admin), then serves the file from disk. So the client’s download URL is e.g. `BASE_URL/media/courses/:courseId/attachments/notes.pdf` with the same `Authorization: Bearer` header; the backend verifies enrollment (or role) before sending the file.

**Enrollment**

- `POST /enrollments` – Student only. Body: `{ courseId }`. Create enrollment. Returns `{ enrollment: { id, courseId, enrolledAt, score? } }`.
- `GET /enrollments` – Student only. Query **`?locale=es|en`**. Returns `{ enrollments: [{ id, courseId, course: { title, slug, difficulty? }, enrolledAt, score? }] }` with **course title in requested locale**.
- `GET /courses/:id/enrollment` – Auth. Returns `{ enrolled: true|false, score? }` (score only if enrolled and set).
- `PATCH /enrollments/:id` or `PATCH /courses/:courseId/enrollment/score` – Professor or admin only. Body: `{ score }` (number). Set or update final course grade for an enrollment.

**Playback (HLS URL)**

- `GET /courses/:id/lessons/:lessonId/playback` – Auth. If user is not enrolled (and not professor of this course and not admin), return 403. Otherwise resolve the lesson’s `hlsPath` to a base URL (e.g. `req.protocol + '://' + req.get('host') + '/media/' + lesson.hlsPath + '/playlist.m3u8'`) and return `{ playlistUrl: "..." }`. The client (web or Flutter) will use this URL in an HLS player. Serve the actual files under `/media/:path*` with middleware that checks auth and enrollment before calling `next()` or serving static from the corresponding folder.

**Progress**

- `POST /progress` or `PATCH /progress` – Student only. Body: `{ lessonId, completed?, lastPositionSeconds? }`. Upsert progress. Returns `{ progress: { lessonId, completed, lastPositionSeconds } }`.
- `GET /progress` – Student only. Query: `?courseId=`. Returns `{ progress: [{ lessonId, completed, lastPositionSeconds, lastAccessedAt }] }`.

**Admin**

- `GET /users` – Admin only. List users. Returns `{ users: [{ id, email, role, name }] }`.
- `PATCH /users/:id` – Admin only. Body: `{ role? }`. Update user role.

---

### D.5.1 Edition pages and admin pages (frontend)

The API supports all CRUD needed for **edition pages** (edit UIs) and **admin pages**. The frontend should implement:

**Course edit page (professor)**

- Route: e.g. `/courses/:id/edit` or inside “My courses” → Edit. Load course with `GET /courses/:id`, then submit changes with `PATCH /courses/:id`. Editable: title, titleEn, description, descriptionEn, slug, imageUrl, difficulty, published. **Attachments:** List course attachments (GET /courses/:id/attachments); “Add attachment” → form (title, titleEn, filePath, type: pdf | image). Professor uploads PDF/image via FTP to e.g. `media/courses/:courseId/attachments/` then creates record with POST /courses/:id/attachments. Edit/delete with PATCH/DELETE. **No lesson media on the course itself** – lesson media is managed per lesson.

**Lesson create / edit page (professor)**

- Create: e.g. “Add lesson” from course edit or course detail → form → `POST /courses/:id/lessons` with title, titleEn, description, descriptionEn, sortOrder, **mediaType**, **hlsPath**. **This is where media is set:** professor enters the `hlsPath` (e.g. `courses/courseId/lessons/lessonId`) after generating HLS locally and uploading via FTP, and chooses `mediaType` (audio | video).
- Edit: e.g. “Edit lesson” → load lesson (from course detail or GET lesson) → form → `PATCH /courses/:id/lessons/:lessonId` with the same fields. **Media is editable:** professor can change `hlsPath` (e.g. after re-uploading new HLS) and `mediaType`.
- **Course attachments (professor):** On course edit page, section “Course materials” or “Attachments”. List attachments; “Add attachment”: form with title (ES/EN), filePath (after uploading file via FTP to `media/courses/:courseId/attachments/filename.pdf`), type (PDF | Image). POST /courses/:id/attachments; edit/delete with PATCH/DELETE. Students see attachments on course detail and download via the protected /media/ URL or download endpoint.

**Admin pages**

- **Users:** List users (`GET /users`), edit role (`PATCH /users/:id` with `{ role }`). Optional: search, filters.
- **Enrollment grades:** Professor or admin can set course score for an enrollment: `PATCH /enrollments/:id` or `PATCH /courses/:courseId/enrollment/score` with `{ score }`. This can be a dedicated “Grade student” page or part of course management.
- Optional: admin view of all courses (read-only or moderate); course/lesson edit can be restricted to professor-owner, with admin override if needed.

So: **course update page** = metadata + **attachments** (PDFs, images); **lesson create/edit page** = metadata + **media (hlsPath, mediaType)**; **admin** = users and roles (and optionally enrollment scores). All of this is already covered by the API above.

---

### D.6 Serving HLS with Access Control

- Store HLS and **course attachments** (PDFs, images) under a single root (e.g. `media/`). Structure: `media/courses/<courseId>/lessons/<lessonId>/playlist.m3u8` and `segment*.ts`; `media/courses/<courseId>/attachments/<filename>.pdf` (or .png, .jpg).
- **Do not** mount this root as public static. Use a route like `GET /media/*` and middleware that:
  1. Extracts the path after `/media/` (e.g. `courses/courseId/lessons/lessonId/playlist.m3u8` or `courses/courseId/attachments/notes.pdf`).
  2. Verifies JWT and loads user.
  3. Resolves course (from path: courseId in first segment); checks enrollment (or professor or admin).
  4. If allowed, serves the file from disk with appropriate Content-Type (e.g. .m3u8, .ts, .pdf, .png, .jpg). If not allowed, return 403 JSON.

Alternatively, the playback endpoint returns a **signed URL** (e.g. short-lived token in query) that a separate route accepts and then serves the file; same permission check before serving.

---

### D.7 TypeScript and Code Style (Inline Conventions)

- **Named exports** only (no default exports except where a framework requires it).
- **Dot notation for env:** Always `process.env.PORT`, never `process.env['PORT']`.
- **Explicit return types** on route handlers and public functions: e.g. `(): void` or `(): Promise<void>`.
- **Error responses:** Always `res.status(...).json({ status: 'error', error: string })`.
- **Naming:** camelCase for variables and functions; PascalCase for types and classes; UPPER_SNAKE for constants. Use `type` for object shapes; prefer `ReadonlyArray<T>` and `as const` where appropriate.
- **Imports:** Use `import type` for type-only imports.

---

## Part E: Frontend and Mobile (Consumption Guide)

### E.1 Base URL and Auth Header

- **Base URL:** e.g. `https://your-domain.com` or `http://localhost:3000`. All API calls are to `BASE_URL + path` (e.g. `GET /courses`).
- **Auth:** After login or register, store the `token` (e.g. in memory, localStorage, or secure store). Send it on every request: `Authorization: Bearer <token>`.
- **401:** If the API returns 401, clear the stored token and redirect to login.
- **Locale:** Send the user’s language on every request that returns course/lesson content: **`?locale=es`** or **`?locale=en`**, or header **`Accept-Language: es`** / **`Accept-Language: en`**. **Default is Spanish (es).** The backend returns title/description in that locale (fallback to Spanish when en is missing).

---

### E.2 Key Flows (Web)

- **Login page:** POST `/auth/login` with `{ email, password }` → store token and user → redirect to dashboard or catalog.
- **Locale:** Store the app language (es | en) in state or localStorage; **default is Spanish (es)**. Use it for (1) **app UI** (labels, buttons) via an i18n library (e.g. react-i18next, vue-i18n) with message files for `es` and `en`, and (2) **API:** append `?locale=es` or `?locale=en` to all requests that return course/lesson content (catalog, course detail, lessons, enrollments).
- **Catalog:** GET `/courses?locale=...` → render list; link to course detail.
- **Course detail:** GET `/courses/:id?locale=...` → show course and lessons; if not enrolled, show “Enroll” button (POST `/enrollments` with `{ courseId }`).
- **Lesson player:** GET `/courses/:id/lessons/:lessonId/playback` → get `playlistUrl` → load in HLS player. On pause or completion, PATCH `/progress` with `{ lessonId, completed, lastPositionSeconds }`.
- **Student dashboard:** GET `/enrollments?locale=...` and GET `/progress?courseId=...` → show “My courses” and continue learning (next lesson).
- **Professor dashboard:** GET `/courses/my?locale=...` → list courses; create/edit course and lessons (send both `title`/`titleEn`, `description`/`descriptionEn` when saving); for each lesson, professor sets `hlsPath`. Instructions: generate HLS locally (Part B), upload via FTP, set `hlsPath`.

---

### E.3 Flutter (Later)

- Same base URL and `Authorization: Bearer <token>`.
- **Locale:** Support **Spanish (es)** and **English (en)**; **default is Spanish.** Use Flutter l10n (e.g. `flutter_localizations`, `intl`, ARB files for `es` and `en`) for app UI strings. Store the selected locale (e.g. in shared_preferences) and send it to the API on every request that returns course/lesson content: **`?locale=es`** or **`?locale=en`**. The API returns localized title/description; fallback to Spanish when en is missing.
- Use an HLS-capable package to play `playlistUrl` from the playback endpoint.
- Implement login, catalog, course detail, enrollment, lesson player, and progress (PATCH on pause/complete). Optionally professor flows (course/lesson CRUD) with both language fields when creating/editing.

---

## Part F: Commands Summary

**Local development (backend root):**

```bash
cp .env.example .env
npm install
npm run build
npm run dev
```

**Generate HLS (backend root; ffmpeg on PATH):**

```bash
npm run generate-hls -- <channelOrLessonId> <inputPath>
# Example: npm run generate-hls -- course-1-lesson-1 ./samples/courses/course-1/lesson-1
```

**Deploy to production (backend root; .env.prod with FTP vars):**

```bash
npm run build
npm run deploy-mochahost
```

Then on the server (Plesk/SSH) in the app root:

```bash
npm install --production
# Restart IIS application
```

**Verify FFmpeg (new terminal after adding to PATH):**

```batch
ffmpeg -version
```

---

## Part G: Enterprise Design (API & Database)

This section summarizes **enterprise-grade** practices for online academies and learning platforms. Apply what fits the MVP; treat the rest as a roadmap for when the product scales or must meet compliance (e.g. FERPA, audits, multi-tenant).

---

### G.1 API Design (Enterprise Practices)

**Resource-oriented URLs**

- Use **plural nouns** for collections: `/courses`, `/users`, `/enrollments`, not `/course` or `/getUsers`.
- Use **nested resources** when one entity belongs to another: `/courses/:id/lessons`, `/courses/:id/enrollments`. For “current user” scoped data use `/users/me` or `/me` (not `/users/:id` with token-derived id in URL).
- Prefer **stable, opaque IDs** (UUID) in URLs rather than slugs for mutable resources; use slug only for public-facing, cacheable URLs (e.g. course catalog) if needed.

**HTTP methods and status codes**

- **GET** – Read; no body; idempotent. Return 200 with body, 404 if not found, 401/403 for auth.
- **POST** – Create (e.g. `/courses`, `/enrollments`); return 201 Created with `Location` header and body; 400 for validation errors; 409 if conflict (e.g. already enrolled).
- **PATCH** – Partial update; return 200 with updated resource; 400 for bad input; 404 if resource missing.
- **PUT** – Full replace if used; for MVP, PATCH is often enough.
- **DELETE** – 204 No Content on success; 404 if not found; 403 if not allowed (e.g. delete another user’s course).
- **Consistent error body:** Always `{ status: 'error', error: string }`; optionally add `code` (e.g. `VALIDATION_ERROR`), `details` (array of field errors), or `requestId` for support. Use 422 for validation, 429 for rate limit.

**API versioning**

- From day one, prefix all API routes with a version: `/api/v1/courses`, `/api/v1/auth/login`. This allows future breaking changes under `/api/v2/` without breaking existing clients.
- In the app, mount routers under `app.use('/api/v1', v1Router)` and keep v1 routes stable. Document “v1 supported until …” when you introduce v2.
- Alternative (less common for REST): version via header (`Accept-Version: v1`) or query; URL versioning is the most common and cache-friendly.

**Security (OWASP-aware)**

- **Authentication:** JWT in `Authorization: Bearer <token>`. Prefer short-lived access tokens (e.g. 15–60 min) and refresh tokens (e.g. 7–30 days) stored securely on the client; rotate refresh tokens on use. For MVP, a single longer-lived JWT is acceptable if documented.
- **Authorization:** Check **per resource**: e.g. “can this user access this course/lesson?” (enrollment, role). Never trust client to send “allowed” resource ids only; always resolve resource server-side and verify the acting user has permission (avoids IDOR).
- **Input:** Validate and sanitize all inputs; use parameterized queries (Prisma does this); reject oversized bodies and malformed JSON.
- **Rate limiting:** Apply per IP or per user (e.g. 100 req/min for auth, 1000/min for general). Return 429 with `Retry-After` when exceeded.
- **Sensitive data:** Do not log passwords or tokens; do not return password hashes in API responses; use HTTPS only in production.

**Pagination and filtering**

- List endpoints (e.g. `GET /courses`, `GET /users`) should support **pagination**: `?page=1&limit=20` or `?cursor=...&limit=20`. Return metadata: `{ items: [...], total, page, limit }` or `{ items: [...], nextCursor }`.
- **Filtering:** Use query params: `?published=true`, `?professorId=...`, `?search=...`. Keep parameter names consistent and documented.

---

### G.2 Database Design (Enterprise Practices)

**Normalization and relationships**

- **Users** – One table; role in column or separate `user_roles` if a user can have multiple roles. Avoid duplicating user data across tables; use foreign keys (e.g. `Course.professorId` → `User.id`).
- **Courses and lessons** – One-to-many (Course has many Lessons). Use `sortOrder` or `position` for stable ordering; avoid relying only on `createdAt` for “order of lessons.”
- **Enrollments** – Many-to-many between Users and Courses with an explicit table: `Enrollment(userId, courseId, enrolledAt, ...)`. Unique constraint on `(userId, courseId)`.
- **Progress** – Per user per lesson (and optionally per course aggregate). Unique on `(userId, lessonId)`. Store `lastPositionSeconds` and `completed` for resume and completion tracking.
- **Avoid** storing derived data that can be recomputed (e.g. “total lessons completed”) unless you need it for performance; if stored, keep it in sync via application logic or triggers.

**Audit and traceability**

- **Created/updated:** Every main entity should have `createdAt` and `updatedAt` (Prisma `@updatedAt`).
- **Soft delete:** For compliance and “undo,” consider `deletedAt` (nullable timestamp). Queries filter `WHERE deletedAt IS NULL`; “delete” becomes `UPDATE ... SET deletedAt = now()`. Restore by setting `deletedAt = NULL`. Apply to User, Course, Lesson as needed.
- **Audit log (enterprise):** A separate `audit_log` table: `userId`, `action` (e.g. `course.created`, `enrollment.created`), `resourceType`, `resourceId`, `ip`, `userAgent`, `createdAt`. Log at least: login failures, role changes, course publish/unpublish, enrollment, and access to sensitive data (e.g. bulk export). Retain logs per policy (e.g. 3 years for education).

**Multi-tenancy (optional for MVP)**

- If the same instance will serve multiple “schools” or “organizations,” add a **tenant** dimension: e.g. `Organization` table and `tenantId` (or `organizationId`) on User, Course, etc. Every query filters by `tenantId` (from JWT or context). Isolate data so one tenant never sees another’s data. Use a single database with tenant_id columns (row-level isolation) unless you need separate DBs per tenant.

**Education-specific (FERPA / data privacy)**

- **PII and education records:** Treat student data (grades, progress, enrollments, communications) as sensitive. In the schema, avoid storing more PII than needed; use RBAC so only authorized roles (instructor, admin) see full data. Students see only their own progress and enrollments.
- **Encryption:** Use TLS for all traffic; consider encryption at rest for DB (e.g. SQL Server TDE or host-level encryption). Store passwords with a strong hash (bcrypt/argon2).
- **Retention and deletion:** Define how long you keep logs and user data; support “delete my data” (e.g. set `deletedAt`, anonymize or purge after 30–90 days). Document in a privacy policy.
- **Access logging:** Log who accessed which student/course data and when (audit table or dedicated logging). Required for FERPA-style compliance in many jurisdictions.

---

### G.3 Content and Integration Standards (Future)

Enterprise academies often integrate with existing content or tools. Plan for these without implementing in MVP:

- **SCORM** – Packaged eLearning content (zip with manifest). LMS launches the package and receives completion/score via JavaScript. If you later support “SCORM lessons,” you will need a launch endpoint, a viewer, and a way to store completion/score in your Progress (or a separate SCORM result table).
- **xAPI (Experience API)** – Learning events in “actor, verb, object” form sent to a Learning Record Store (LRS). Enables analytics across LMS, mobile, and external activities. For MVP you can skip; later, you can emit xAPI statements when a user completes a lesson or passes a quiz and store them in your DB or forward to an LRS.
- **LTI (Learning Tools Interoperability)** – Lets external tools (e.g. video platform, quiz tool) be launched from your LMS with SSO and context (course, user). Requires LTI 1.3/Advantage setup (registration, JWTs). Add when you need to embed third-party tools inside courses.

Design the **API and DB so that** “completion” and “score” are first-class (Progress, optional Quiz/Result tables); then SCORM and xAPI can map onto the same tables or events later.

---

### G.4 Summary for Implementers

- **API:** Versioned (`/api/v1/...`), resource-oriented, correct HTTP semantics, consistent errors, auth on every protected route, authorization per resource, pagination and filtering on lists.
- **Database:** Normalized tables, FKs for relationships, `createdAt`/`updatedAt`, optional soft delete and audit log; consider tenant id if multi-tenant; treat student data as sensitive and minimize PII.
- **Compliance:** Audit log for sensitive actions, encryption in transit and at rest, retention/deletion policy, access logging for education records.

Implement MVP first; add versioning, audit, soft delete, and rate limiting as soon as the first client depends on the API or compliance is required.

---

**Design (UX/UI and database):** For a sober, Apple HIG–inspired frontend (color scheme, typography, page frames), and for database design with normalization and **performance on shared hosting** (indexes, avoiding N+1, pagination, eager loading), use **Part H: UX/UI & Database Design (Academy)** below. That section defines the visual design and the Prisma schema with indexes; the rest of this handoff defines API and behavior.

---

This document is self-contained. Implement the backend and frontend (and later Flutter) following the patterns, code samples, and endpoints above without relying on any other repository or file.

---

## Part I: Multi-Academy Support (Industry Standard & Model)

The product should support **multiple “academies” or paths** under the same site (e.g. `/career` and `/investing`), each with its own branding, color scheme, and course list. Below is how the **standard and enterprise online course / LMS industry** models this, followed by the concrete model for this system.

### I.1 Industry standard: multi-tenant and multi-brand LMS

**Multi-tenant LMS (Moodle Workplace, Paradiso, e-KHOOL, etc.)**

- A **single platform** serves multiple organizations (tenants/academies). Each tenant has:
  - Its own **branding**: logo, theme, colors, optional custom domain or base path
  - Its own **course catalog** and learning content
  - Its own **users** (or shared users with tenant context) and roles
  - **Data isolation** between tenants; admin can manage all from one place
- **Data model:** A dedicated **tenant table** (id, name, shortname/slug, wwwroot or base path, theme, language, status). Key entities (e.g. Course, CourseCategory) have a **tenant ID foreign key**. Users may be global or scoped per tenant depending on product.

**Canvas LMS**

- **Hierarchical accounts:** One root account with sub-accounts (unlimited depth). Courses belong to an account; permissions and settings flow down. Sub-accounts can have different branding and settings. Good fit for one institution with many departments/schools.

**White-label / SaaS (Thinkific, Teachable, Mighty Networks)**

- Each “brand” often gets its own **site or tenant**: custom domain, full branding (logo, colors), own course catalog. Same codebase, different configuration per tenant.

**Common patterns**

- **Path-based:** All under one domain with a segment per academy, e.g. `/career`, `/investing`, or `/career/courses`, `/investing/courses`.
- **Subdomain-based:** e.g. `career.academy.com`, `investing.academy.com` (requires routing/DNS).
- **One tenant table** (here: **Academy**) with **slug**, **name**, **branding** (primary color, logo URL, optional CSS/theme key). **Course** (and optionally Category) belongs to one Academy. Catalog and all course URLs are scoped by academy.

### I.2 Academy entity and URL structure

**Academy** is the top-level “section” or “path”:

- **slug** – Unique URL segment (e.g. `career`, `investing`). Used in routes: `/:academySlug`, `/:academySlug/courses`, `/:academySlug/courses/:courseSlug`.
- **name** – Display name (e.g. “Career Academy”, “Investing”).
- **branding** – Optional: `primaryColor` (hex), `logoUrl`, `faviconUrl`, optional `theme` key for future CSS variants. Frontend uses these so each path has its own look.

**Course** belongs to **one Academy** (required FK `academyId`). Catalog and course detail are always in the context of an academy (e.g. list only courses for that academy).

**Users (students, professors, admins)** can remain **global** in MVP: one user can enroll in or teach courses in any academy. Optionally later: restrict professors to certain academies via a join table or `academyId` on a “professor assignment” table.

**API and routes (conceptual)**

- `GET /api/v1/academies` – List active academies (slug, name, branding) for nav or homepage.
- `GET /api/v1/academies/:academySlug` – Single academy by slug (for branding and display name).
- Catalog: `GET /api/v1/academies/:academySlug/courses` – Published courses for that academy (paginated). Optional: `?locale=es|en`, `?difficulty=...`.
- Course detail: `GET /api/v1/academies/:academySlug/courses/:courseSlug` – Course in that academy (or 404 if slug/academy mismatch).
- Enrollments and progress stay user-based; course is already scoped by academy when resolved via the above.

**Frontend**

- **Router:** Top-level path is academy slug (`/career`, `/investing`). All catalog, course, and lesson routes live under `/:academySlug/...`. Resolve academy by slug and apply its branding (colors, logo) to the layout.
- **Catalog:** One catalog per academy; same component, different data and branding.
- **Design (Part H):** Apply the same HIG-inspired layout and components; only the accent color, logo, and copy come from the selected academy.

### I.3 Schema addition: Academy and Course.academyId

Add model **Academy** and **academyId** on **Course** (and unique constraint so the same course slug is unique per academy, not globally). Example:

```prisma
model Academy {
  id           String   @id @default(uuid())
  slug         String   @unique   // e.g. 'career', 'investing'
  name         String   // display name
  primaryColor String?  // hex, e.g. '#0071E3'
  logoUrl      String?
  faviconUrl   String?
  active       Boolean  @default(true)
  sortOrder    Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  courses      Course[]

  @@index([active])
}

model Course {
  id          String    @id @default(uuid())
  academyId   String
  academy     Academy   @relation(fields: [academyId], references: [id])
  professorId String
  professor   User      @relation("ProfessorCourses", fields: [professorId], references: [id])
  title       String
  titleEn     String?
  description String?
  descriptionEn String?
  slug        String    // unique per academy, not globally
  imageUrl    String?
  difficulty  String?
  published   Boolean   @default(false)
  sortOrder   Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  lessons     Lesson[]
  enrollments Enrollment[]
  attachments CourseAttachment[]

  @@unique([academyId, slug])
  @@index([academyId])
  @@index([academyId, published, sortOrder])
  @@index([professorId])
}
```

**Migration note:** If Course already exists without Academy, introduce Academy first (e.g. one default academy with slug `default`), add `academyId` to Course (nullable or backfill all to default), then set `@@unique([academyId, slug])` and drop the old global `slug` unique if present.

---

## Part H: UX/UI & Database Design (Academy)

This section defines **frontend design** (Apple HIG–inspired, sober look), **page frames**, **color scheme**, and **database design** with normalization and **performance** for cheap shared hosting.

---

### H.1 UX/UI (Apple HIG–inspired, sober)

#### H.1.1 Design principles (from Apple HIG)

Apply these to the web frontend so the academy feels clear, calm, and professional:

- **Clarity** – Every screen has one primary task. Use legible typography, clear labels, and minimal decoration. Buttons and links look like what they do (e.g. “Enroll”, “Continue lesson”).
- **Deference** – The UI supports the content; it doesn’t compete with it. Course titles and lesson content are the focus. Chrome (nav, headers) is subtle: light borders or soft background, not loud colors or heavy shadows.
- **Depth** – Use subtle hierarchy: one level of shadow or a light divider to separate header from content; cards for course tiles with a very light shadow or border so they feel tappable. Avoid flat, noisy layouts.
- **Consistency** – Same patterns everywhere: primary action on the right or full-width; secondary actions (Cancel, Back) in the same place; list pages look like list pages; forms look like forms. Use the same spacing scale (e.g. 8px grid) and the same component set.

**Accessibility (HIG-aligned):** Don’t rely on color alone for state (e.g. use icon + color for “completed”). Keep contrast high (text on background). Support reduced motion if you add animations.

---

#### H.1.2 Color scheme (sober, professional)

Two variants: **light (default)** and **dark**. Default is light for readability and a calm, “academy” feel.

**Light theme**

| Role        | Usage                    | Hex       | Notes                          |
|------------|---------------------------|-----------|---------------------------------|
| Background | Page background           | `#F5F5F7` | Soft gray (Apple-style)         |
| Surface    | Cards, modals, inputs     | `#FFFFFF` | Pure white                     |
| Border     | Dividers, input borders   | `#D2D2D7` | Neutral gray                    |
| Text       | Primary text              | `#1D1D1F` | Near black                     |
| Text       | Secondary / muted         | `#6E6E73` | Gray                           |
| Accent     | Primary buttons, links    | `#0071E3` | Blue (Apple-style accent)      |
| Accent     | Hover / active            | `#005BB5` | Darker blue                    |
| Success    | Completed, success state  | `#34C759` | Green (optional)               |
| Error      | Errors, destructive       | `#FF3B30` | Red (sparingly)                |

**Dark theme (optional)**

| Role    | Hex       |
|---------|-----------|
| Background | `#000000` |
| Surface    | `#1C1C1E` |
| Border     | `#38383A` |
| Text       | `#F5F5F7` |
| Text muted | `#98989D` |
| Accent     | `#0A84FF` |

**Rules:** One primary accent (blue). No bright oranges or purples for main UI. Use the accent for one primary action per screen; keep the rest neutral (gray/white). Sober = limited palette, no gradients on large areas.

---

#### H.1.3 Typography

- **Font:** System stack for body and UI:  
  `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`  
  Optional: **Inter** or **SF Pro** (if licensed) for a more “Apple” feel; fallback to system.
- **Scale (sober):**
  - Page title: 24–28px, semibold (600).
  - Section title: 18–20px, semibold.
  - Body: 16px, regular (400); line-height 1.5.
  - Small / captions: 14px, regular; color secondary.
  - Buttons: 16px, medium (500).
- **Minimum:** Don’t go below 14px for body text. Use medium/semibold for emphasis, not light/thin.

---

#### H.1.4 Page frames (layout and content)

Common layout: **top bar (header) + main content**. No sidebar for students; optional compact sidebar for professor “My courses” or admin if needed.

**Global**

- **Header:** Height ~56–64px. Logo (or “Academy”) left; right: “Catalog”, “My courses” (if logged-in student), “Dashboard” (if professor), “Admin” (if admin), “Log in” / “Sign up” or avatar + dropdown (Profile, Log out). Background: surface color; bottom border 1px border color. Sticky.
- **Main:** Max-width ~960–1200px, centered; padding 24px (or 16px on small screens). No full-bleed except for the lesson player.

---

**1. Catalog (public)**

- **Frame:** Header + main. Main = title “Courses” (or localized) + optional filters (search, difficulty dropdown, locale switcher). Below: **grid of course cards** (2–3 columns desktop, 1 column mobile).
- **Course card:** Surface background, border or very light shadow, border-radius 12px, padding 16px. Content: image (or placeholder) top, then title (2 lines max), short description (2–3 lines), difficulty badge (optional), “View” or “See course” link. No loud colors; accent only on the CTA.
- **Empty:** “No courses yet” + short message.

---

**2. Course detail (public)**

- **Frame:** Header + main. Breadcrumb optional: Catalog > Course title.
- **Content:** Course image/banner (or placeholder), title, description (full), difficulty, lesson count. List of **lessons** (ordered): each row = lesson title, duration (if any), “Locked” or “Play”/“Resume” if enrolled. **Attachments (course materials):** section “Materials” or “Resources” with list of PDFs and images (title + type icon); each item is a link to view/download (protected URL). Only visible to enrolled users (or show “Enroll to access materials” if not enrolled). One primary button: **“Enroll”** (if not enrolled) or **“Continue”** (if enrolled, to next lesson). Sober: lots of whitespace; content first.

---

**3. Lesson player**

- **Frame:** Minimal header (back to course + course title) or no header; **full-width main** for the player. Below player: lesson title, optional description. Below that: “Mark complete” (if not done), “Next lesson” button. Optional: progress bar (segment of course progress).
- **Player:** HLS player (video or audio); controls standard (play, pause, seek, volume). Background dark (`#0a0a0a`) around video so the player is the focus (deference).

---

**4. Student dashboard (“My courses”)**

- **Frame:** Header + main. Title “My courses”. List or grid of **enrolled courses**: card = course title, progress (e.g. “3/10 lessons”), “Continue” (to next lesson) or “View course”. Sober list/card layout; accent on “Continue”.

---

**5. Professor dashboard (“My courses”)**

- **Frame:** Header + main. Title “My courses”. List of **own courses**: title, published (yes/no), lesson count, “Edit” / “View”. Button “Create course”. Table or cards; “Edit” is secondary (outline or text), “Create course” is primary (accent).

---

**6. Course edit (professor)**

- **Frame:** Header + main. Breadcrumb: My courses > Course title > Edit. Form: title (ES), title (EN), description (ES), description (EN), slug, image URL, difficulty, published (toggle). Sections grouped with subtle headings. Buttons: “Save” (primary), “Cancel” (secondary). Optional: “Lessons” section below with list of lessons + “Add lesson”.

---

**7. Lesson create / edit (professor)**

- **Frame:** Header + main. Form: title (ES), title (EN), description (ES), description (EN), sort order, **media type** (audio / video), **HLS path** (text input: e.g. `courses/courseId/lessons/lessonId`). Help text: “Generate HLS locally, upload via FTP, then enter the path here.” Buttons: “Save”, “Cancel”.

---

**8. Admin – Users**

- **Frame:** Header + main. Title “Users”. Table: email, name, role, actions (“Edit role”). Optional search. “Edit role” opens modal or inline: dropdown role (student, professor, admin), “Save”. Sober table: borders or zebra striping very light.

---

**9. Login / Register**

- **Frame:** Centered card (max-width 400px). Logo or title at top. Form: email, password (and name for register). One primary button “Log in” / “Sign up”. Link to the other (e.g. “Don’t have an account? Sign up”). No clutter; single column.

---

#### H.1.5 Components (sober)

- **Buttons:** Primary = accent background, white text, border-radius 8px, padding 12px 20px. Secondary = outline (border accent) or gray. Danger = red only for destructive actions.
- **Inputs:** Border 1px, border-radius 8px, padding 10px 14px; focus ring 2px accent (no heavy glow).
- **Cards:** Surface color, border or shadow subtle, border-radius 12px; padding 16px or 24px.
- **Tables:** Header row semibold; row borders or very light striping; adequate padding.

Use the same spacing scale everywhere (e.g. 4, 8, 16, 24, 32 px).

---

### H.2 Database design (normalized, performance for shared hosting)

#### H.2.1 Normalization

Tables are in **3NF** (Third Normal Form): no transitive dependencies; each non-key attribute depends only on the primary key.

| Table       | Purpose | Normalization note |
|------------|---------|--------------------|
| **User**   | One row per user; role and profile. | No duplicate user data; role is a single attribute (or 1:1 UserRole if you later need multiple roles). |
| **Academy** | One row per “path” or brand (e.g. career, investing). | Slug unique; branding (primaryColor, logoUrl) and name depend only on academy id. |
| **Course** | One row per course; academy FK, professor FK. | Course belongs to one academy; slug unique per academy (`@@unique([academyId, slug])`). Professor stored once. |
| **Lesson** | One row per lesson; course FK. | Lesson depends only on lesson id; courseId is FK (no repeated course data in lessons). |
| **Enrollment** | Many-to-many User–Course with extra data (enrolledAt, score). | Separate table avoids repeating user/course data; (userId, courseId) unique. |
| **Progress** | Per user per lesson (completed, lastPosition). | Separate table; (userId, lessonId) unique; no repeating lesson/course data. |
| **CourseAttachment** | Per-course PDFs and images (reinforce course). | One row per file; courseId FK; filePath, type (`pdf` \\| `image`), title/titleEn; no duplicate course data. |

**No denormalization** of full course title into Enrollment or Progress for now; join when needed. If the host is very slow, consider a **read-only cached** “enrollment with course title” only where strictly necessary and refresh sparingly.

---

#### H.2.2 Tables and indexes

Indexes are chosen for **frequent filters and joins** on shared hosting: reduce full table scans and keep query time low.

```prisma
datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  role         String   // 'student' | 'professor' | 'admin'
  name         String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  courses      Course[] @relation("ProfessorCourses")
  enrollments  Enrollment[]
  progress     Progress[]

  @@index([role])  // Admin list users by role
}

model Academy {
  id           String   @id @default(uuid())
  slug         String   @unique   // e.g. 'career', 'investing' – URL segment
  name         String   // display name
  primaryColor String?  // hex, e.g. '#0071E3'
  logoUrl      String?
  faviconUrl   String?
  active       Boolean  @default(true)
  sortOrder    Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  courses      Course[]

  @@index([active])
}

model Course {
  id           String    @id @default(uuid())
  academyId    String
  academy      Academy   @relation(fields: [academyId], references: [id])
  professorId  String
  professor    User      @relation("ProfessorCourses", fields: [professorId], references: [id])
  title        String
  titleEn      String?
  description  String?
  descriptionEn String?
  slug         String    // unique per academy (see @@unique)
  imageUrl     String?
  difficulty   String?
  published    Boolean   @default(false)
  sortOrder    Int       @default(0)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  lessons      Lesson[]
  enrollments  Enrollment[]
  attachments  CourseAttachment[]

  @@unique([academyId, slug])
  @@index([academyId])
  @@index([academyId, published, sortOrder])  // Catalog per academy
  @@index([professorId])
}

model CourseAttachment {
  id        String   @id @default(uuid())
  courseId  String
  course    Course   @relation(fields: [courseId], references: [id])
  title     String
  titleEn   String?
  filePath  String   // relative, e.g. courses/:courseId/attachments/slides.pdf
  type      String   // 'pdf' | 'image'
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())

  @@index([courseId])  // List attachments by course
}

model Lesson {
  id              String   @id @default(uuid())
  courseId        String
  course          Course   @relation(fields: [courseId], references: [id])
  title           String
  titleEn         String?
  description     String?
  descriptionEn   String?
  sortOrder       Int      @default(0)
  durationSeconds Int?
  mediaType       String
  hlsPath         String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  progress        Progress[]

  @@index([courseId])            // Lessons by course
  @@index([courseId, sortOrder]) // Ordered lessons in course
}

model Enrollment {
  id         String   @id @default(uuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  courseId   String
  course     Course   @relation(fields: [courseId], references: [id])
  enrolledAt DateTime @default(now())
  score      Float?

  @@unique([userId, courseId])
  @@index([userId])   // Student's enrollments
  @@index([courseId]) // Enrollments per course
}

model Progress {
  id                  String   @id @default(uuid())
  userId              String
  user                User     @relation(fields: [userId], references: [id])
  lessonId            String
  lesson              Lesson   @relation(fields: [lessonId], references: [id])
  completed           Boolean  @default(false)
  lastPositionSeconds Int?
  lastAccessedAt      DateTime @updatedAt

  @@unique([userId, lessonId])
  @@index([userId])   // Student's progress
  @@index([lessonId]) // Progress per lesson (optional, for stats)
}
```

---

#### H.2.3 Performance (shared hosting)

Cheap shared hosting = limited CPU and memory; few concurrent DB connections. Optimize to **fewer, lighter queries**.

**1. Avoid N+1**

- Use **eager loading** for relations needed in one response.  
  Example: catalog = list courses with lesson count → one query for courses, then one aggregated count (or `include: { _count: { select: { lessons: true } } }`) instead of N queries for lessons.
- **List enrollments with course title:**  
  `Enrollment.findMany({ where: { userId }, include: { course: { select: { id, title, titleEn, slug, difficulty } } } })` in **one** query. Do not load enrollments and then loop and fetch course per row.
- **Course detail with lessons and attachments:**  
  `Course.findUnique({ where: { id }, include: { lessons: { orderBy: { sortOrder: 'asc' } }, attachments: { orderBy: { sortOrder: 'asc' } } } })` in one query.

**2. Select only what you need**

- Prefer `select: { id, title, slug, ... }` instead of loading full models when you don’t need every field (e.g. catalog list doesn’t need `description` or `descriptionEn` for cards). Reduces data transfer and memory.
- For “playback” you only need lesson `hlsPath` and maybe `mediaType`; don’t load full course tree.

**3. Read-only paths: use `findMany` / `findUnique` without change tracking**

- Prisma: for read-only endpoints (catalog, course detail, enrollments list), use `.findMany()` / `.findUnique()` without subsequent `update` in the same request. Consider `$queryRaw` or a thin wrapper that uses read replicas if the host provides them later; for a single DB, at least avoid unnecessary writes so the connection pool isn’t tied up.

**4. Pagination**

- **Always paginate** list endpoints: `skip` / `take` (e.g. 20 per page). Never `findMany` without limit on courses or users. Reduces response size and query time.

**5. Indexes (already in schema)**

- Catalog: `published`, `sortOrder` (and composite `published, sortOrder`) so “published courses ordered” is index-backed.
- Professor’s courses: `professorId`.
- Enrollments by student: `userId`.
- Lessons by course: `courseId`, `courseId + sortOrder`.
- Unique constraints `(userId, courseId)` and `(userId, lessonId)` also support lookups.

**6. Heavy work outside the request**

- Don’t run heavy reporting or bulk updates inside a request. If you add “export” or “recompute scores,” run them in a job or script, not in the API on shared hosting.

**7. Connection and pool**

- Use a **single PrismaClient** instance (singleton). On serverless or limited connections, configure connection pool size in `DATABASE_URL` or Prisma to match the host’s limit (e.g. 5–10 connections).

---

#### H.2.4 Summary

- **UX/UI:** Apple HIG–inspired (clarity, deference, depth, consistency); sober light theme with one blue accent; system font stack; page frames for catalog, course detail, lesson player, student/professor dashboards, course/lesson edit, admin users, login/register.
- **DB:** Normalized tables (User, Academy, Course, Lesson, Enrollment, Progress, CourseAttachment) with indexes on FKs and common filters; unique constraints on `(academyId, slug)` for Course, `(userId, courseId)` and `(userId, lessonId)`.
- **Performance:** Eager load to avoid N+1; select only needed fields; paginate lists; use indexes; single PrismaClient; keep heavy work off the request path so the backend runs well on cheap shared hosting.
