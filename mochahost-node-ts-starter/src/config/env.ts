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
