/* Frame-exact export of a tutorial video from the kiosk route → MP4 (H.264), then music.
   node render.cjs <id> [--vertical] [--from ms --to ms]   (needs the site on SITE_URL) */
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');

const SITE = process.env.SITE_URL || 'http://localhost:3100';
const id = process.argv[2];
const vertical = process.argv.includes('--vertical');
const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? +process.argv[i + 1] : null; };
const FPS = 30;
const path = require('path');
const OUTDIR = path.join(process.env.PNV_WORK || path.join(require('os').tmpdir(), 'page-notes-videos'), 'out');

(async () => {
  fs.mkdirSync(OUTDIR, { recursive: true });
  const b = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  const vp = vertical ? { width: 720, height: 1280 } : { width: 1280, height: 720 };
  const p = await b.newPage({ viewport: vp, deviceScaleFactor: 1.5 });
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto(`${SITE}/components/page-notes-extension/tutorial?render=1&v=${id}`, { waitUntil: 'load', timeout: 180000 });
  await p.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  await p.waitForFunction(() => window.__pnTotal, null, { timeout: 180000 });
  await p.evaluate(() => document.fonts.ready);
  const total = await p.evaluate(() => window.__pnTotal);
  const from = arg('--from') ?? 0, to = arg('--to') ?? total;
  const frames = Math.round(((to - from) / 1000) * FPS);
  const raw = path.join(OUTDIR, `${id}.video.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', raw], { stdio: ['pipe', 'inherit', 'inherit'] });
  await p.evaluate((ms) => window.__pnSeek(ms), from);
  await p.waitForTimeout(800);
  const t0 = Date.now();
  for (let f = 0; f < frames; f++) {
    await p.evaluate((ms) => window.__pnSeek(ms), from + (f * 1000) / FPS);
    const buf = await p.screenshot({ type: 'jpeg', quality: 93 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 300 === 0) console.log(id, f, '/', frames, Math.round((Date.now() - t0) / 1000) + 's');
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await b.close();
  // music (+ narration, music ducked under the voice)
  const secs = (to - from) / 1000;
  const wav = path.join(OUTDIR, `${id}.wav`);
  execFileSync('node', [path.join(__dirname, 'music.cjs'), vertical ? 'pop' : 'lofi', String(Math.ceil(secs + 1)), wav]);
  const final = path.join(OUTDIR, `${id}.mp4`);
  const voice = path.join(OUTDIR, 'voice', `${id}.m4a`);
  const fadeAt = Math.max(0, secs - 2.5).toFixed(2);
  if (!vertical && fs.existsSync(voice)) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-i', voice, '-i', wav, '-filter_complex',
      `[1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=1.0,asplit=2[v1][v2];` +
      `[2:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.42[m];` +
      `[m][v1]sidechaincompress=threshold=0.015:ratio=12:attack=20:release=450[md];` +
      `[md][v2]amix=inputs=2:normalize=0:duration=first,afade=t=out:st=${fadeAt}:d=2.5,alimiter=limit=0.95[a]`,
      '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final]);
    // second version: music only, no narration
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-i', wav, '-filter_complex', `[1:a]volume=0.55,afade=t=out:st=${fadeAt}:d=2.5[a]`, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', path.join(OUTDIR, `${id}-music-only.mp4`)]);
  } else {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-i', wav, '-filter_complex', `[1:a]volume=${vertical ? 0.9 : 0.55},afade=t=out:st=${fadeAt}:d=2.5[a]`, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final]);
  }
  console.log('done', final, secs.toFixed(1) + 's');
})();
