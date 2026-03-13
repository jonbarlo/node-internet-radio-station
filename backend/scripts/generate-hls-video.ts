/**
 * Generate HLS for channel-3 from one video file or all videos in a folder.
 * Output: channels/channel-3/playlist.m3u8 + segment*.ts
 *
 * Usage:
 *   npm run generate-hls-video -- ./samples/channel-3/myfile.mp4
 *   npm run generate-hls-video -- ./samples/channel-3
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const CHANNEL3_DIR = path.resolve(process.cwd(), 'channels', 'channel-3');
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.avi', '.webm']);

function main(): void {
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: npm run generate-hls-video -- <path-to-file-or-folder>');
    console.error('  Single file: npm run generate-hls-video -- ./samples/channel-3/video.mp4');
    console.error('  Folder:      npm run generate-hls-video -- ./samples/channel-3');
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), input.replace(/^["']|["']$/g, ''));

  if (!fs.existsSync(inputPath)) {
    console.error('Not found:', inputPath);
    process.exit(1);
  }

  if (!fs.existsSync(CHANNEL3_DIR)) {
    fs.mkdirSync(CHANNEL3_DIR, { recursive: true });
  }

  const stat = fs.statSync(inputPath);
  let files: string[];

  if (stat.isDirectory()) {
    files = fs.readdirSync(inputPath)
      .filter((name) => VIDEO_EXTENSIONS.has(path.extname(name).toLowerCase()))
      .map((name) => path.join(inputPath, name))
      .sort();
    if (files.length === 0) {
      console.error('No video files found in', inputPath);
      process.exit(1);
    }
    console.log('Found', files.length, 'video(s) in', inputPath);
  } else {
    if (!VIDEO_EXTENSIONS.has(path.extname(inputPath).toLowerCase())) {
      console.error('Not a supported video file:', inputPath);
      process.exit(1);
    }
    files = [inputPath];
  }

  const segmentList = path.join(CHANNEL3_DIR, 'playlist.m3u8');
  const segmentPattern = path.join(CHANNEL3_DIR, 'segment%05d.ts');

  if (files.length === 1) {
    runFfmpeg(files[0]!, segmentList, segmentPattern);
  } else {
    const listPath = path.join(CHANNEL3_DIR, 'concat-list.txt');
    const listContent = files
      .map((f) => `file '${path.resolve(f).replace(/\\/g, '/').replace(/'/g, "'\\''")}'`)
      .join('\n');
    fs.writeFileSync(listPath, listContent, 'utf8');
    runFfmpeg(listPath, segmentList, segmentPattern, true);
    try { fs.unlinkSync(listPath); } catch { /* ignore */ }
  }

  console.log('Done. HLS written to', CHANNEL3_DIR);
}

function runFfmpeg(
  input: string,
  segmentList: string,
  segmentPattern: string,
  isConcat = false
): void {
  const inputArg = isConcat ? ['-f', 'concat', '-safe', '0', '-i', input] : ['-i', input];
  const args = [
    '-y',
    ...inputArg,
    '-c', 'copy',
    '-f', 'segment',
    '-segment_format', 'mpegts',
    '-segment_time', '10',
    '-segment_list', segmentList,
    '-segment_list_type', 'm3u8',
    segmentPattern,
  ];
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
}

main();
