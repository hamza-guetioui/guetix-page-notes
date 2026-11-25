/* Capture copy of the extension (same UI; two tweaks so a script can drive it):
   - the shadow root is open (Playwright can find the toolbar / notes),
   - popup.html?for=<url part> treats that tab as the active one (the popup is recorded in its own window). */
const fs = require('fs');
const path = require('path');
module.exports = function prepareExt() {
  const WORK = process.env.PNV_WORK || path.join(require('os').tmpdir(), 'page-notes-videos');
  const src = path.join(__dirname, '..', '..', '..', 'extensions', 'page-notes');
  const dst = path.join(WORK, 'ext');
  fs.rmSync(dst, { recursive: true, force: true });
  fs.cpSync(src, dst, { recursive: true });
  const c = path.join(dst, 'content.js');
  fs.writeFileSync(c, fs.readFileSync(c, 'utf8').replace('attachShadow({ mode: "closed" })', 'attachShadow({ mode: "open" })'));
  const p = path.join(dst, 'popup.js');
  const a = 'chrome.tabs.query({ active: true, currentWindow: true }, start);';
  const b = `var __for = new URLSearchParams(location.search).get("for");
    if (__for) { window.close = function () { window.__closed = true; }; chrome.tabs.query({}, function (ts) { start(ts.filter(function (t) { return (t.url || "").indexOf(__for) > -1; }).slice(0, 1)); }); }
    else ${a}`;
  const js = fs.readFileSync(p, 'utf8');
  if (!js.includes(a)) throw new Error('popup.js changed: update prepare-ext.cjs');
  fs.writeFileSync(p, js.replace(a, b));
};
