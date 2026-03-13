/**
 * Generate HLS (playlist.m3u8 + .ts segments) for a channel.
 *
 * INPUT can be:
 *   - A folder: ffmpeg reads all .mp3 (and .m4a) files inside, sorts by name, and concatenates them.
 *   - A single file: one .mp3 or .m4a.
 *
 * Requires: ffmpeg installed (https://ffmpeg.org/).
 * Usage (from backend/):
 *   npm run generate-hls -- channel-1 ./samples/channel-1
 *   npm run generate-hls -- channel-2 ./samples/channel-2
 * Put your .mp3/.m4a files in backend/samples/channel-1/ and samples/channel-2/ first.
 *
 * Output is written to the channel folder (e.g. channels/channel-1/).
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CWD = process.cwd();
const CHANNEL_1_PATH = process.env.CHANNEL_1_PATH ?? 'channels/channel-1';
const CHANNEL_2_PATH = process.env.CHANNEL_2_PATH ?? 'channels/channel-2';
const CHANNEL_3_PATH = process.env.CHANNEL_3_PATH ?? 'channels/channel-3';

const CHANNEL_PATHS: Record<string, string> = {
  'channel-1': path.resolve(CWD, CHANNEL_1_PATH),
  'channel-2': path.resolve(CWD, CHANNEL_2_PATH),
  'channel-3': path.resolve(CWD, CHANNEL_3_PATH),
};

function main(): void {
  const channelId = process.argv[2];
  const inputPath = process.argv[3];

  if (!channelId || !inputPath) {
    console.error('Usage: npm run generate-hls -- channel-1 ./samples/channel-1');
    console.error('       npm run generate-hls -- channel-2 ./samples/channel-2');
    console.error('       npm run generate-hls -- channel-3 ./samples/channel-3');
    console.error('Put your .mp3/.m4a (or video) files in backend/samples/channel-*');
    process.exit(1);
  }

  const outDir = CHANNEL_PATHS[channelId];
  if (!outDir) {
    console.error('Channel must be channel-1, channel-2, or channel-3');
    process.exit(1);
  }

  const inputResolved = path.resolve(inputPath);
  if (!fs.existsSync(inputResolved)) {
    console.error('Input path does not exist:', inputResolved);
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const stat = fs.statSync(inputResolved);
  let inputArg: string;
  let isConcat = false;

  const AUDIO_EXT = ['.mp3', '.m4a'];

  if (stat.isDirectory()) {
    const files = fs.readdirSync(inputResolved)
      .filter((f) => AUDIO_EXT.some((ext) => f.toLowerCase().endsWith(ext)))
      .sort();
    if (files.length === 0) {
      console.error('No .mp3 or .m4a files found in folder:', inputResolved);
      process.exit(1);
    }
    console.log('Input folder: %s (%d files)', inputResolved, files.length);
    const listPath = path.join(outDir, '_concat_list.txt');
    const listContent = files
      .map((f) => {
        const full = path.join(inputResolved, f).replace(/\\/g, '/');
        return "file '" + full.replace(/'/g, "'\\''") + "'";
      })
      .join('\n');
    fs.writeFileSync(listPath, listContent);
    inputArg = `-f concat -safe 0 -i "${listPath}"`;
    isConcat = true;
  } else {
    const ext = path.extname(inputResolved).toLowerCase();
    if (!AUDIO_EXT.includes(ext)) {
      console.warn('Warning: expected .mp3 or .m4a file; got', ext);
    }
    inputArg = `-i "${inputResolved}"`;
  }

  const segmentList = path.join(outDir, 'playlist.m3u8');
  const segmentPattern = path.join(outDir, 'segment%05d.ts');

  const cmd = `ffmpeg -y ${inputArg} -vn -ac 2 -acodec aac -f segment -segment_format mpegts -segment_time 10 -segment_list "${segmentList}" -segment_list_type m3u8 "${segmentPattern}"`;

  console.log('Running ffmpeg (this may take a while)...');
  console.log('Output folder:', outDir);

  try {
    execSync(cmd, { stdio: 'inherit' });
    if (isConcat) {
      try { fs.unlinkSync(path.join(outDir, '_concat_list.txt')); } catch { /* ignore */ }
    }
    console.log('Done. playlist.m3u8 and segments written to', outDir);
  } catch (err) {
    console.error('ffmpeg failed. Make sure ffmpeg is installed (https://ffmpeg.org/).');
    process.exit(1);
  }
}

main();
