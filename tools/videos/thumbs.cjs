/* YouTube thumbnails (1280×720) + playlist posters (224×126) from the rendered videos. node thumbs.cjs id:seconds ... */
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const PUB = require('path').join(__dirname, '..', '..', '..', 'public', 'tutorial', 'page-notes', 'posters');
const TITLES = { 'how-it-works': ['HOW IT', 'WORKS'], 'extension-bar': ['THE', 'EXTENSION BAR'], toolbar: ['THE', 'TOOLBAR'], 'note-options': ['NOTE', 'OPTIONS'], 'all-notes': ['ALL', 'NOTES'], settings: ['SETTINGS', 'TOUR'] };
const NUM = { 'how-it-works': 1, 'extension-bar': 2, toolbar: 3, 'note-options': 4, 'all-notes': 5, settings: 6 };
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  for (const a of process.argv.slice(2)) {
    const [id, sec] = a.split(':');
    const frame = path.resolve(`out/${id}-frame.jpg`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', sec, '-i', `out/${id}.mp4`, '-frames:v', '1', '-q:v', '2', frame]);
    // playlist poster: the plain frame
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', frame, '-vf', 'scale=448:252', '-q:v', '4', `${PUB}/${id}.jpg`]);
    const img = 'data:image/jpeg;base64,' + fs.readFileSync(frame).toString('base64');
    const [l1, l2] = TITLES[id];
    await p.setContent(`<html><body style="margin:0;width:1280px;height:720px;overflow:hidden;background:#0b0c10;font-family:'Segoe UI',system-ui,sans-serif">
      <img src="${img}" style="position:absolute;right:-60px;top:40px;width:900px;border-radius:18px;transform:rotate(-2deg);box-shadow:0 30px 80px rgba(0,0,0,.7)">
      <div style="position:absolute;inset:0;background:linear-gradient(90deg,#0b0c10 30%,rgba(11,12,16,.75) 52%,rgba(11,12,16,0) 75%)"></div>
      <div style="position:absolute;left:64px;top:70px;display:flex;align-items:center;gap:18px">
        <div style="position:relative;width:86px;height:86px;border-radius:17px;background:#ff5b14;clip-path:polygon(0 0,100% 0,100% 70%,70% 100%,0 100%)">
          <i style="position:absolute;left:18px;top:29px;width:16px;height:16px;background:#141414;border-radius:3px"></i><i style="position:absolute;left:52px;top:29px;width:16px;height:16px;background:#141414;border-radius:3px"></i>
          <i style="position:absolute;right:0;bottom:0;width:26px;height:26px;background:linear-gradient(to bottom right,#b9400c 50%,transparent 50%)"></i></div>
        <div style="color:#fff;font:900 40px ui-monospace,Consolas,monospace;letter-spacing:-1px">PAGE<span style="color:#ff5b14">_</span>NOTES</div>
      </div>
      <div style="position:absolute;left:64px;top:220px;color:#fff;font-weight:900;font-size:104px;line-height:.95;letter-spacing:-4px;text-shadow:0 6px 30px rgba(0,0,0,.6)">${l1}<br><span style="color:#ff9a3c">${l2}</span></div>
      <div style="position:absolute;left:64px;bottom:64px;display:flex;gap:12px;align-items:center">
        <span style="background:linear-gradient(135deg,#ff9a3c,#ff5b14 60%,#ff4d4d);color:#141414;font:800 26px ui-monospace,Consolas,monospace;padding:10px 18px;border-radius:8px">${String(NUM[id]).padStart(2, '0')} / 06</span>
        <span style="color:#fff;font-size:28px;font-weight:700;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);padding:9px 18px;border-radius:999px">Free Chrome extension</span>
      </div></body></html>`);
    await p.waitForTimeout(200);
    await p.screenshot({ path: `out/${id}-thumb.jpg`, type: 'jpeg', quality: 92 });
    console.log('thumb', id);
  }
  await b.close();
})();
