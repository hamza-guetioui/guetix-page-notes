/* Chrome Web Store kit (v1.3): 1280×800 screenshots, 440×280 + 1400×560 promo tiles — real frames of the recordings. */
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const OUT = 'out/store';
fs.mkdirSync(OUT, { recursive: true });
const grab = (id, sid, t, name) => {
  const f = `${OUT}/${name}.png`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(t), '-i', `rec/${id}/${id}-${sid}.mp4`, '-frames:v', '1', f]);
  return 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
};
const MARK = (s) => `<span style="position:relative;display:inline-block;width:${s}px;height:${s}px;border-radius:${s * 0.2}px;background:linear-gradient(rgba(255,255,255,.6),rgba(255,255,255,.6)) no-repeat 50% 0/${s * 0.44}px ${s * 0.13}px,#ff5b14;clip-path:polygon(0 0,100% 0,100% 70%,70% 100%,0 100%);flex:none">
  <i style="position:absolute;left:${s * 0.21}px;top:${s * 0.34}px;width:${s * 0.19}px;height:${s * 0.19}px;background:#141414;border-radius:${s * 0.04}px"></i>
  <i style="position:absolute;left:${s * 0.6}px;top:${s * 0.34}px;width:${s * 0.19}px;height:${s * 0.19}px;background:#141414;border-radius:${s * 0.04}px"></i>
  <i style="position:absolute;right:0;bottom:0;width:${s * 0.3}px;height:${s * 0.3}px;background:linear-gradient(to bottom right,#b9400c 50%,transparent 50%)"></i></span>`;
const BG = `background:radial-gradient(60% 80% at 0% 0%,rgba(255,91,20,.45),transparent 60%),radial-gradient(50% 70% at 100% 100%,rgba(124,58,237,.35),transparent 60%),radial-gradient(40% 60% at 60% 110%,rgba(14,165,233,.25),transparent 60%),#0b0c10;`;
const browser = (img, url, { badge = 0, w = 1152, x = 64, y = 128, popup } = {}) => {
  const h = w / 2;
  return `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;border-radius:14px;overflow:hidden;background:#202124;border:1px solid rgba(255,255,255,.12);box-shadow:0 30px 80px rgba(0,0,0,.6)">
    <div style="height:34px;display:flex;align-items:center;gap:8px;padding:0 12px"><i style="width:12px;height:12px;border-radius:50%;background:#ff5f57"></i><i style="width:12px;height:12px;border-radius:50%;background:#febc2e"></i><i style="width:12px;height:12px;border-radius:50%;background:#28c840"></i></div>
    <div style="height:40px;background:#35363a;display:flex;align-items:center;gap:12px;padding:0 14px;color:#9aa0a6;font:14px system-ui">
      <span>← → ↻</span><div style="flex:1;height:28px;border-radius:999px;background:#202124;color:#e8eaed;display:flex;align-items:center;padding:0 14px;font-size:13px">🔒&nbsp; ${url}</div>
      <span style="position:relative;display:grid;place-items:center;width:30px;height:28px;border-radius:6px;background:${popup ? 'rgba(255,255,255,.14)' : 'transparent'}">${MARK(18)}${badge ? `<b style="position:absolute;right:-3px;bottom:-1px;background:#ff5b14;color:#fff;font:700 9px/13px monospace;padding:0 3px;border-radius:3px">${badge}</b>` : ''}</span><span>⋮</span></div>
    <img src="${img}" style="display:block;width:${w}px;height:${h}px;object-fit:cover">
  </div>
  ${popup ? `<img src="${popup}" style="position:absolute;left:${x + w - 330}px;top:${y + 70}px;width:300px;height:${300 * 600 / 380}px;border-radius:10px;box-shadow:0 20px 60px rgba(0,0,0,.6)">` : ''}`;
};
const shot = (title, sub, inner) => `<html><body style="margin:0;width:1280px;height:800px;overflow:hidden;${BG}font-family:'Segoe UI',system-ui,sans-serif;color:#fff">
  <div style="position:absolute;left:64px;top:34px;display:flex;align-items:center;gap:18px">${MARK(56)}
  <div><div style="font-weight:900;font-size:36px;letter-spacing:-1px;line-height:1.1">${title}</div><div style="margin-top:4px;font-size:19px;color:rgba(255,255,255,.72)">${sub}</div></div></div>
  <div style="position:absolute;right:64px;top:44px;display:flex;align-items:center;gap:10px;padding:6px 16px 6px 6px;border-radius:999px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.15);font-weight:600;font-size:16px"><span style="display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#fff;color:#000;font-weight:900;font-size:11px">GX</span>Free · private · no account</div>
  ${inner}</body></html>`;

(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const S = [
    ['1-sticky-notes-any-website', 'Sticky notes on any website', 'Click anywhere, type, done. They stay where you put them.', browser(grab('how-it-works', 'main', 28.5, 'f1'), 'streamly.tv/watch?v=productive', { badge: 2 })],
    ['2-highlight-text', 'Highlight text, add a note', 'Select a sentence — it is highlighted with your note right next to it.', browser(grab('how-it-works', 'main', 52.5, 'f2'), 'guetix.com/extensions/page-notes-extension', { badge: 1 })],
    ['3-review-any-site', 'Review any website — even your own', 'Leave feedback on the page. Notes come back on your next visit.', browser(grab('how-it-works', 'main', 76.5, 'f3'), 'guetix.com', { badge: 3 })],
    ['4-extension-bar', 'Everything in one click', 'This page, this site, everywhere — filter, mark done, jump to a note.', browser(grab('extension-bar', 'main', 8, 'f4'), 'app.pulse.io/acme/overview', { badge: 2, popup: grab('extension-bar', 'popup', 8, 'f4p') })],
    ['5-all-notes', 'All your notes in one place', 'Search, filter and edit every note — with a snapshot of where it sits.', browser(grab('all-notes', 'main', 3, 'f5'), 'chrome-extension://page-notes/notes.html')],
  ];
  for (const [name, t, s, inner] of S) {
    await p.setContent(shot(t, s, inner));
    await p.waitForTimeout(150);
    await p.screenshot({ path: `${OUT}/screenshot-${name}.png` });
    console.log('shot', name);
  }
  const f3 = grab('how-it-works', 'main', 76.5, 'f3');
  // small promo tile 440×280
  await p.setViewportSize({ width: 440, height: 280 });
  await p.setContent(`<html><body style="margin:0;width:440px;height:280px;overflow:hidden;${BG}font-family:'Segoe UI',system-ui,sans-serif;color:#fff">
    <img src="${f3}" style="position:absolute;right:-120px;top:70px;width:380px;border-radius:10px;transform:rotate(-3deg);box-shadow:0 16px 40px rgba(0,0,0,.6);opacity:.95">
    <div style="position:absolute;left:24px;top:28px">${MARK(52)}</div>
    <div style="position:absolute;left:24px;top:96px;font:900 30px/1 ui-monospace,Consolas,monospace;letter-spacing:-1px">PAGE<span style="color:#ff5b14">_</span>NOTES</div>
    <div style="position:absolute;left:24px;top:138px;width:210px;font-weight:800;font-size:22px;line-height:1.15">Sticky notes on any website</div>
    <div style="position:absolute;left:24px;bottom:22px;font-size:13px;color:rgba(255,255,255,.75)">Free · private · no account</div></body></html>`);
  await p.screenshot({ path: `${OUT}/small-promo-tile-440x280.png` });
  // marquee 1400×560
  await p.setViewportSize({ width: 1400, height: 560 });
  const f1 = grab('how-it-works', 'main', 28.5, 'f1');
  await p.setContent(`<html><body style="margin:0;width:1400px;height:560px;overflow:hidden;${BG}font-family:'Segoe UI',system-ui,sans-serif;color:#fff">
    <img src="${f1}" style="position:absolute;right:300px;top:120px;width:560px;border-radius:12px;transform:rotate(-4deg);box-shadow:0 20px 60px rgba(0,0,0,.6)">
    <img src="${f3}" style="position:absolute;right:-40px;top:70px;width:620px;border-radius:12px;transform:rotate(3deg);box-shadow:0 20px 60px rgba(0,0,0,.6)">
    <div style="position:absolute;left:70px;top:86px;display:flex;align-items:center;gap:18px">${MARK(70)}<span style="font:900 44px ui-monospace,Consolas,monospace;letter-spacing:-1px">PAGE<span style="color:#ff5b14">_</span>NOTES</span></div>
    <div style="position:absolute;left:70px;top:200px;width:520px;font-weight:900;font-size:58px;line-height:1.02;letter-spacing:-2px">Sticky notes on <span style="color:#ff9a3c">any</span> website.</div>
    <div style="position:absolute;left:70px;top:346px;width:480px;font-size:22px;color:rgba(255,255,255,.78)">Pin, highlight, find them again. Saved on your device.</div>
    <div style="position:absolute;left:70px;top:420px;padding:12px 22px;border-radius:8px;background:linear-gradient(135deg,#ff9a3c,#ff5b14 60%,#ff4d4d);color:#141414;font:800 20px ui-monospace,Consolas,monospace;box-shadow:4px 4px 0 #000">FREE · ADD TO CHROME</div></body></html>`);
  await p.screenshot({ path: `${OUT}/marquee-promo-tile-1400x560.png` });
  await b.close();
  for (const f of fs.readdirSync(OUT)) if (/^f\d/.test(f)) fs.unlinkSync(`${OUT}/${f}`);
  console.log('ok');
})();
