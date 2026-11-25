/* YouTube chapter timestamps for each video (same scene math as the player). */
const fs = require('fs');
const path = require('path');
const WORK = process.env.PNV_WORK || path.join(require('os').tmpdir(), 'page-notes-videos');
process.chdir(WORK);
const VIDEOS = [
  ['how-it-works', 'How it works', [['Install & pin it', 9000]], [['Private by design', 6000]]],
  ['extension-bar', 'The extension bar', [], []],
  ['toolbar', 'The on-page toolbar', [], []],
  ['note-options', 'Note options', [], []],
  ['all-notes', 'All notes', [], []],
  ['settings', 'Settings', [], []],
];
const fmt = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const out = {};
for (const [id, name, pre, post] of VIDEOS) {
  const tl = JSON.parse(fs.readFileSync(`rec/${id}/${id}.json`, 'utf8'));
  const cuts = tl.cuts || [];
  const vf = `out/voice/${id}.json`;
  const v = fs.existsSync(vf) ? JSON.parse(fs.readFileSync(vf, 'utf8')) : null;
  let t = 0;
  const list = [['Intro', 0]];
  t += v ? v.title : 3400;
  pre.forEach(([n, d], k) => { list.push([n, t]); t += v ? Math.max(d, v.pre[k]) : d; });
  tl.chapters.forEach((c, i) => {
    const end = tl.chapters[i + 1]?.t ?? tl.duration;
    const cut = cuts.reduce((n, [a, b]) => (a >= c.t && a < end ? n + Math.min(b, end) - a : n), 0);
    list.push([c.title, t]);
    t += Math.max(500, end - c.t - cut) + (v ? v.holds[i] : 0);
  });
  post.forEach(([n, d], k) => { list.push([n, t]); t += v ? Math.max(d, v.post[k]) : d; });
  list.push(['Get it free', t]);
  t += v ? v.outro : 6000;
  out[id] = { name, total: fmt(t), chapters: list.map(([n, ms]) => `${fmt(ms)} ${n}`) };
}
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync('out/chapters.json', JSON.stringify(out, null, 1));
