import express, { type Request, type Response } from 'express';
import { config } from './config/env';

const app = express();

app.use(express.json());

app.get('/', (_req: Request, res: Response): void => {
  res.json({
    name: 'mochahost-node-ts-starter',
    version: '0.1.0',
    endpoints: ['/health'],
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
