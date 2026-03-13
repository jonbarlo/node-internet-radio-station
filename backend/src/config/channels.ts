import path from 'path';
import fs from 'fs';

/**
 * App root: same folder as dist/ and channels/. Use __dirname so it works when
 * process.cwd() is not the app root (e.g. on IIS/Mochahost).
 * This file runs as dist/config/channels.js → app root = ../..
 */
const APP_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Channel config: id, name, and local folder path.
 * Folder must contain pre-generated HLS: playlist.m3u8 and .ts segments.
 */
export type ChannelConfig = {
  id: string;
  name: string;
  path: string;
};

const CHANNEL_1_PATH = process.env.CHANNEL_1_PATH ?? 'channels/channel-1';
const CHANNEL_2_PATH = process.env.CHANNEL_2_PATH ?? 'channels/channel-2';

const rawChannels: ReadonlyArray<{ id: string; name: string; path: string }> = [
  { id: 'channel-1', name: 'Channel 1', path: CHANNEL_1_PATH },
  { id: 'channel-2', name: 'Channel 2', path: CHANNEL_2_PATH },
];

function resolveChannelDir(relativePath: string): string {
  return path.resolve(APP_ROOT, relativePath);
}

export const channels: ReadonlyArray<ChannelConfig> = rawChannels.map((ch) => ({
  id: ch.id,
  name: ch.name,
  path: resolveChannelDir(ch.path),
}));

/**
 * Get channel by id.
 */
export function getChannelById(id: string): ChannelConfig | undefined {
  return channels.find((c) => c.id === id);
}

/**
 * Check if a channel folder exists and has a playlist (playlist.m3u8 or index.m3u8).
 */
export function getChannelPlaylistPath(channel: ChannelConfig): string | null {
  const names = ['playlist.m3u8', 'index.m3u8'];
  for (const name of names) {
    const full = path.join(channel.path, name);
    if (fs.existsSync(full)) {
      return name;
    }
  }
  return null;
}
