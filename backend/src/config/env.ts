/**
 * Config reads process.env only (use dot notation for Mochahost).
 * Dotenv must be loaded before this runs (loadEnv.ts is imported first in server.ts).
 */
const PORT = process.env.PORT ?? '3000';
const NODE_ENV = process.env.NODE_ENV ?? 'development';

export const config = {
  port: Number.parseInt(PORT, 10) || 3000,
  nodeEnv: NODE_ENV as 'development' | 'production' | 'test',
  isProduction: NODE_ENV === 'production',
};
