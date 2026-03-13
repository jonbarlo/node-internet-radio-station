/**
 * Scan samples/channel-1 and samples/channel-2 for audio files and report
 * which have title, artist, album, and cover (picture) metadata.
 *
 * Usage (from backend/):
 *   npm run check-audio-meta
 *   npm run check-audio-meta -- --export   # also write channels/channel-N/tracks.json for the player
 */
import fs from 'fs';
import path from 'path';
// music-metadata v7 for CommonJS; v8+ is ESM-only
import mm from 'music-metadata';

const CWD = process.cwd();
const SAMPLE_DIRS = ['samples/channel-1', 'samples/channel-2'];
const EXT = ['.mp3', '.m4a'];

type MetaRow = {
  file: string;
  title: boolean;
  artist: boolean;
  album: boolean;
  picture: boolean;
  titleVal?: string;
  artistVal?: string;
  albumVal?: string;
};

async function scanDir(dir: string): Promise<MetaRow[]> {
  const abs = path.resolve(CWD, dir);
  if (!fs.existsSync(abs)) return [];
  const files = fs.readdirSync(abs)
    .filter((f) => EXT.some((e) => f.toLowerCase().endsWith(e)))
    .sort();
  const rows: MetaRow[] = [];
  for (const file of files) {
    const filePath = path.join(abs, file);
    try {
      const meta = await mm.parseFile(filePath);
      const common = meta.common;
      const picture = common.picture && common.picture.length > 0;
      rows.push({
        file,
        title: !!common.title,
        artist: !!common.artist,
        album: !!common.album,
        picture: !!picture,
        titleVal: common.title,
        artistVal: common.artist,
        albumVal: common.album,
      });
    } catch (err) {
      rows.push({
        file,
        title: false,
        artist: false,
        album: false,
        picture: false,
      });
      console.error('  Error reading', file, (err as Error).message);
    }
  }
  return rows;
}

function report(rows: MetaRow[], label: string): void {
  if (rows.length === 0) {
    console.log(`\n${label}: no audio files found`);
    return;
  }
  console.log(`\n${label} (${rows.length} files)`);
  console.log('─'.repeat(72));
  const missing = { title: 0, artist: 0, album: 0, picture: 0 };
  rows.forEach((r) => {
    if (!r.title) missing.title++;
    if (!r.artist) missing.artist++;
    if (!r.album) missing.album++;
    if (!r.picture) missing.picture++;
    const t = r.title ? r.titleVal ?? '✓' : '—';
    const a = r.artist ? r.artistVal ?? '✓' : '—';
    const al = r.album ? r.albumVal ?? '✓' : '—';
    const p = r.picture ? '✓' : '—';
    console.log(`  ${r.file.slice(0, 36).padEnd(36)}  title: ${String(t).slice(0, 20).padEnd(20)}  artist: ${String(a).slice(0, 18).padEnd(18)}  album: ${String(al).slice(0, 16).padEnd(16)}  art: ${p}`);
  });
  console.log('─'.repeat(72));
  console.log(`  Missing: title ${missing.title} | artist ${missing.artist} | album ${missing.album} | cover ${missing.picture}`);
}

async function exportTracksJson(sampleDir: string, channelId: string): Promise<void> {
  const abs = path.resolve(CWD, sampleDir);
  const outDir = path.resolve(CWD, 'channels', channelId);
  if (!fs.existsSync(abs)) return;
  const files = fs.readdirSync(abs)
    .filter((f) => EXT.some((e) => f.toLowerCase().endsWith(e)))
    .sort();
  const tracks: Array<{ title: string; artist: string; album: string; duration?: number; picture?: string }> = [];
  for (const file of files) {
    const filePath = path.join(abs, file);
    try {
      const meta = await mm.parseFile(filePath);
      const c = meta.common;
      const duration = meta.format?.duration;
      let pictureDataUrl: string | undefined;
      if (c.picture && c.picture.length > 0) {
        const p = c.picture[0];
        const b64 = Buffer.from(p.data).toString('base64');
        const mime = p.format ?? 'image/jpeg';
        pictureDataUrl = `data:${mime};base64,${b64}`;
      }
      tracks.push({
        title: c.title ?? path.parse(file).name,
        artist: c.artist ?? 'Unknown',
        album: c.album ?? '',
        duration: duration != null ? Math.round(duration) : undefined,
        picture: pictureDataUrl,
      });
    } catch {
      tracks.push({
        title: path.parse(file).name,
        artist: 'Unknown',
        album: '',
      });
    }
  }
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'tracks.json');
  fs.writeFileSync(outPath, JSON.stringify(tracks, null, 2));
  console.log('  Wrote', outPath);
}

async function main(): Promise<void> {
  const exportFlag = process.argv.includes('--export');
  console.log('Checking audio metadata in', SAMPLE_DIRS.join(', '));
  console.log('(title, artist, album, cover art)\n');

  const channel1 = await scanDir(SAMPLE_DIRS[0]);
  const channel2 = await scanDir(SAMPLE_DIRS[1]);

  report(channel1, 'samples/channel-1');
  report(channel2, 'samples/channel-2');

  if (exportFlag) {
    console.log('\nExporting tracks.json for player...');
    await exportTracksJson(SAMPLE_DIRS[0], 'channel-1');
    await exportTracksJson(SAMPLE_DIRS[1], 'channel-2');
    console.log('Done. Upload channels/ or run deploy with channels enabled to serve tracks.json.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
