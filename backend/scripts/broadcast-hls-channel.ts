/**
 * Broadcast HLS files for one channel to the FTP server (upload to channels/<channel>/ on remote).
 * Uses .env.prod for FTP_HOST, FTP_USER, FTP_PASSWORD, etc.
 *
 * Usage: npm run broadcast-hls-channel -- channel-1
 *        npm run broadcast-hls-channel -- channel-2
 *        npm run broadcast-hls-channel -- channel-3
 */
import path from 'path';
import fs from 'fs';
import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';

const envPath = path.resolve(process.cwd(), '.env.prod');
dotenv.config({ path: envPath });

const ftpConfig = {
  host: process.env.FTP_HOST,
  user: process.env.FTP_USER,
  password: process.env.FTP_PASSWORD,
  port: Number.parseInt(process.env.FTP_PORT ?? '21', 10),
  secure: process.env.FTP_SECURE === 'true',
  remotePath: process.env.FTP_REMOTE_PATH ?? '/',
};

const VALID_CHANNELS = ['channel-1', 'channel-2', 'channel-3'] as const;

function main(): void {
  const channelId = process.argv[2];
  if (!channelId || !VALID_CHANNELS.includes(channelId as (typeof VALID_CHANNELS)[number])) {
    console.error('Usage: npm run broadcast-hls-channel -- channel-1');
    console.error('       npm run broadcast-hls-channel -- channel-2');
    console.error('       npm run broadcast-hls-channel -- channel-3');
    process.exit(1);
  }

  const localChannelPath = path.resolve(process.cwd(), 'channels', channelId);
  if (!fs.existsSync(localChannelPath) || !fs.statSync(localChannelPath).isDirectory()) {
    console.log('Channel folder not found; creating:', localChannelPath);
    fs.mkdirSync(localChannelPath, { recursive: true });
  }

  const required = ['FTP_HOST', 'FTP_USER', 'FTP_PASSWORD'] as const;
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error('Missing in .env.prod:', missing.join(', '));
    process.exit(1);
  }

  runBroadcast(localChannelPath, channelId).catch((err) => {
    console.error('Broadcast failed:', err);
    process.exit(1);
  });
}

async function runBroadcast(localChannelPath: string, channelId: string): Promise<void> {
  const client = new ftp.Client();
  client.ftp.verbose = false;

  const basePath = (ftpConfig.remotePath ?? '/').replace(/\/+$/, '') || '';
  const fullChannelPath = basePath ? `${basePath}/channels/${channelId}` : `channels/${channelId}`;

  try {
    console.log('Connecting to FTP...');
    await client.access({
      host: ftpConfig.host!,
      user: ftpConfig.user!,
      password: ftpConfig.password!,
      port: ftpConfig.port,
      secure: ftpConfig.secure,
    });
    console.log('Connected.');

    // Create remote path and move into it (ensureDir sets working dir to this path)
    await client.ensureDir(fullChannelPath);

    // Upload into current working directory so the server always has a valid path
    console.log('Broadcasting HLS to', fullChannelPath, '...');
    await client.uploadFromDir(localChannelPath);
    console.log('Done. Channel', channelId, 'broadcast to FTP.');
  } finally {
    client.close();
  }
}

main();
