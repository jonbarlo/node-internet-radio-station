import path from 'path';
import express, { type Request, type Response } from 'express';
import { config } from './config/env';
import { streamsRouter, mountStreamStatic } from './modules/streams/streams.routes';

const app = express();

app.use(express.json());

// Static: player pages and assets. Use __dirname so it works when cwd differs (e.g. IIS).
const publicDir = path.resolve(__dirname, '..', 'public');
app.get('/audio-player', (_req: Request, res: Response): void => {
  res.sendFile(path.join(publicDir, 'audio-player.html'));
});
app.get('/video-player', (_req: Request, res: Response): void => {
  res.sendFile(path.join(publicDir, 'video-player.html'));
});
app.get('/player', (_req: Request, res: Response): void => {
  res.redirect(302, '/audio-player');
});
app.get('/player-video', (_req: Request, res: Response): void => {
  res.redirect(302, '/video-player');
});
app.use(express.static(publicDir));

// HLS: serve each channel folder at /streams/:id (playlist.m3u8 + .ts segments)
mountStreamStatic(app);
app.use('/streams', streamsRouter);

app.get('/', (_req: Request, res: Response): void => {
  res.json({
    name: 'radio-station-api',
    version: '0.1.0',
    endpoints: ['/health', '/streams', '/audio-player', '/video-player'],
  });
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
