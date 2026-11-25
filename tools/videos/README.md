# Page Notes — tutorial videos (playlist + reel)

Real recordings of the extension (v1.3) that feed the docs “How it works” playlist
(`src/apps/pickui/tutorial/page-notes-playlist.tsx`) and the YouTube / Instagram exports.

**Not part of the app build.** Needs: Playwright's Chromium (`npx playwright install chromium`,
Chrome stable no longer loads unpacked extensions from the command line), Google Chrome (export,
H.264 playback), `ffmpeg` with libx264 + aac on PATH, and port 80 free.
Work files go to `%TEMP%/page-notes-videos` (override with `PNV_WORK`).

1. Run the site: `npx next dev --turbopack -p 3100` (or set `SITE_PORT`).
2. Fake hosts: `node server.cjs` — serves `sites/` as app.pulse.io / shoply.com / streamly.tv and
   proxies guetix.com to the local site (Chromium maps those hosts to 127.0.0.1).
3. Record: `node shoot.cjs <id>` with id = `how-it-works | extension-bar | toolbar | note-options | all-notes | settings`.
   Each run drives the real extension like a person (pointer, typing, camera, chapters) and writes
   `rec/<id>/<id>.json` (timeline) + `<id>-main.mp4` (+ `<id>-popup.mp4`).
4. Copy `<id>.json` + the mp4s to `public/tutorial/page-notes/recordings/` (the site uses lighter
   re-encodes: `ffmpeg -i in.mp4 -vf scale=1440:-2 -c:v libx264 -crf 28 -preset slow -g 30 -movflags +faststart out.mp4`).
5. Export: `node render.cjs <id>` (16:9 1080p + lo-fi music) or `node render.cjs reel --vertical`
   (9:16 1080×1920 + upbeat music) → `out/<id>.mp4`. `node chapters.cjs` prints YouTube chapters.

`music.cjs` synthesizes the background tracks from scratch (no samples → no licensing).

Extras (run from the work dir with `rec/` and `out/`): `store.cjs` (Chrome Web Store screenshots + promo tiles from
the recordings), `thumbs.cjs id:seconds …` (YouTube thumbnails + playlist posters), `gif.sh in.mp4 start dur out.gif`.
`sites/streamly.tv` uses a real YouTube watch-page screenshot with our own "Streamly" logo over YouTube's.

Narration: `narration.json` holds one line per intro / chapter / card. `voice.mjs` (needs `npm i msedge-tts` in a
scratch folder — Microsoft Edge's online neural voice, default `en-US-ChristopherNeural` (male)) speaks every line, measures it,
and writes `out/voice/<id>.m4a` + `<id>.json` (segment lengths and per-chapter holds, so the video waits for the
voice). Copy both to `public/tutorial/page-notes/voice/`; the playlist and `render.cjs` pick them up (music is ducked
under the voice).
