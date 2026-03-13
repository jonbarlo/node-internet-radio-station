import path from 'path';
import dotenv from 'dotenv';

// Exact Mochahost pattern (see MOCHAHOST-QUICKSTART.md)
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
