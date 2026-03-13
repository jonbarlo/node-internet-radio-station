import { Router, type Request, type Response } from 'express';
import path from 'path';
import express from 'express';
import { channels, getChannelById, getChannelPlaylistPath } from '../../config/channels';

const router = Router();

/**
 * List all streams (channels). Each has id, name, and the HLS playlist URL.
 * Client can use playlistUrl with an HLS player (e.g. hls.js).
 */
router.get('/', (req: Request, res: Response): void => {
  const baseUrl = `${req.protocol}://${req.get('host') ?? ''}`;
  const list = channels.map((ch) => {
    const playlistName = getChannelPlaylistPath(ch);
    const playlistUrl = playlistName
      ? `${baseUrl}/streams/${ch.id}/${playlistName}`
      : null;
    return {
      id: ch.id,
      name: ch.name,
      playlistUrl,
      hasPlaylist: !!playlistName,
    };
  });
  res.json({ streams: list });
});

export { router as streamsRouter };

/**
 * Mount static file serving for each channel at /streams/:id.
 * Call this with the Express app so that /streams/channel-1/playlist.m3u8 etc. are served.
 */
export function mountStreamStatic(app: express.Express): void {
  for (const ch of channels) {
    app.use(
      `/streams/${ch.id}`,
      express.static(ch.path, {
        index: false,
        maxAge: '1h',
      })
    );
  }
}
