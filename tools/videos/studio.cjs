/* Studio: drive the real Page Notes v1.3 extension like a human and record it (CDP screencast + event timeline). */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const WORK = process.env.PNV_WORK || require('path').join(require('os').tmpdir(), 'page-notes-videos');
const EXT = require('path').join(WORK, 'ext');
const OUT = require('path').join(WORK, 'rec');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const noise = (n) => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const VIEW = { width: 1440, height: 720 };
const POP = { width: 380, height: 600 };

async function launch({ profile, fresh = true, dsf = 1.5 } = {}) {
  const prof = profile || require('path').join(WORK, 'profile');
  if (fresh) fs.rmSync(prof, { recursive: true, force: true });
  const ctx = await chromium.launchPersistentContext(prof, {
    channel: 'chromium', headless: true, viewport: VIEW, deviceScaleFactor: dsf,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`,
      '--host-resolver-rules=MAP guetix.com 127.0.0.1, MAP app.pulse.io 127.0.0.1, MAP shoply.com 127.0.0.1, MAP streamly.tv 127.0.0.1',
      '--hide-scrollbars', '--force-color-profile=srgb', '--lang=en-US', '--font-render-hinting=none'],
  });
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker'));
  const id = sw.url().split('/')[2];
  await sleep(700);
  for (const p of ctx.pages()) if (p.url().includes('welcome=1')) await p.close();
  return { ctx, sw, id, ext: (p) => `chrome-extension://${id}/${p}` };
}

// mirror of recorded.tsx geometry (canvas 1280×720, browser at 40,30, 1200 wide)
const G = (() => {
  const FX = 40, FY = 30, FW = 1200, CH = 76;
  const k = FW / VIEW.width;
  const iconX = FX + FW - 82, iconY = FY + 34 + 21;
  const popW = POP.width * k;
  return { FX, FY, CH, k, iconX, iconY, popL: iconX + 26 - popW, popT: FY + CH - 4 };
})();
function toCanvas(sid, x, y) {
  if (sid === 'popup') return [G.popL + x * G.k, G.popT + y * G.k];
  if (sid === 'canvas') return [x, y];
  return [G.FX + x * G.k, G.FY + G.CH + y * G.k];
}
function fromCanvas(sid, X, Y) {
  if (sid === 'popup') return [(X - G.popL) / G.k, (Y - G.popT) / G.k];
  if (sid === 'canvas') return [X, Y];
  return [(X - G.FX) / G.k, (Y - G.FY - G.CH) / G.k];
}

class Studio {
  constructor(env, name) {
    Object.assign(this, env);
    this.name = name;
    this.dir = path.join(OUT, name);
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(this.dir, { recursive: true });
    this.t0 = 0;
    this.tl = { id: name, view: VIEW, pop: POP, surfaces: {}, tab: [], popup: [], cursor: [], clicks: [], keys: [], cams: [], chapters: [], badge: [], marks: [], cuts: [], guides: [], rings: [] };
    this.pos = {}; // last cursor pos per surface
    this.cdp = {};
    this.active = 'main';
  }
  now() { return this.t0 ? Date.now() - this.t0 : 0; }
  start() { this.t0 = Date.now(); }

  /** Start recording a page as a surface. */
  async attach(sid, page, size) {
    const dir = path.join(this.dir, sid);
    fs.mkdirSync(dir, { recursive: true });
    const frames = [];
    const c = await page.context().newCDPSession(page);
    c.on('Page.screencastFrame', async (f) => {
      const t = f.metadata.timestamp ? f.metadata.timestamp * 1000 - this.t0 : this.now();
      const file = path.join(dir, String(frames.length).padStart(6, '0') + '.jpg');
      fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
      frames.push([t, file]);
      c.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    const dsf = await page.evaluate(() => devicePixelRatio);
    await c.send('Page.startScreencast', { format: 'jpeg', quality: 90, everyNthFrame: 1, maxWidth: Math.round(size.width * dsf), maxHeight: Math.round(size.height * dsf) });
    this.cdp[sid] = { c, frames, page, size };
    this.tl.surfaces[sid] = { w: size.width, h: size.height };
    // nudge a repaint so the first frame exists
    await page.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:.01;z-index:-1'; document.documentElement.appendChild(d); setTimeout(() => d.remove(), 60); }).catch(() => {});
  }
  async stopAll() {
    for (const [sid, s] of Object.entries(this.cdp)) await s.c.send('Page.stopScreencast').catch(() => {});
  }

  // ---- timeline ----
  tab(o) { this.tl.tab.push({ t: this.now(), ...o }); }
  popup(open, extra = {}) { this.tl.popup.push({ t: this.now(), open, ...extra }); }
  chapter(title, caption) { this.tl.chapters.push({ t: this.now(), title, caption }); }
  mark(name) { this.tl.marks.push({ t: this.now(), name }); }
  /** Cut dead time (page loads) out of the final video. */
  cutStart() { this._cut = this.now(); }
  cutEnd() { if (this._cut != null) this.tl.cuts.push([this._cut, this.now()]); this._cut = null; }
  /** Camera on the main surface (page css px), eased over `dur` ms starting now. */
  cam(x, y, z, dur = 900) { this.tl.cams.push({ t: this.now(), x, y, z, dur }); }
  wide(dur = 900) { this.cam(VIEW.width / 2, VIEW.height / 2, 1, dur); }
  /** Step guide shown at the bottom ("Click + Note"). Ends the previous one. */
  say(text, dur = 2600) {
    const g = this.tl.guides[this.tl.guides.length - 1];
    const now = this.now();
    if (g && g.t + g.dur > now) g.dur = Math.max(400, now - g.t);
    this.tl.guides.push({ t: now, text, dur });
  }
  ring(sid, b, dur = 1600) { this.tl.rings.push({ t: this.now(), end: this.now() + dur, sid, x: b.x, y: b.y, w: b.width, h: b.height }); return this.tl.rings[this.tl.rings.length - 1]; }
  keys(keys, dur = 1300) { this.tl.keys.push({ t: this.now(), keys, dur }); }

  // ---- human input ----
  logCursor(sid, x, y) { this.pos[sid] = [x, y]; this.lastSid = sid; this.tl.cursor.push([this.now(), sid, Math.round(x * 10) / 10, Math.round(y * 10) / 10]); }
  async move(sid, x, y, dur) {
    const page = sid === 'canvas' ? null : this.cdp[sid].page;
    let [x0, y0] = this.pos[sid] || [x, y];
    if (this.lastSid && this.lastSid !== sid && this.pos[this.lastSid]) [x0, y0] = fromCanvas(sid, ...toCanvas(this.lastSid, ...this.pos[this.lastSid]));
    const dist = Math.hypot(x - x0, y - y0);
    if (dur == null) dur = Math.min(1100, 260 + dist * 0.9);
    const steps = Math.max(1, Math.round(dur / 16));
    const bend = (noise(x + y) - 0.5) * Math.min(dist * 0.18, 60);
    const start = Date.now();
    for (let i = 1; i <= steps; i++) {
      const r = i / steps;
      const t = ease(r);
      const arc = Math.sin(Math.PI * r) * bend;
      const nx = dist ? -(y - y0) / dist : 0;
      const ny = dist ? (x - x0) / dist : 0;
      const px = x0 + (x - x0) * t + nx * arc;
      const py = y0 + (y - y0) * t + ny * arc;
      if (page) await page.mouse.move(px, py);
      this.logCursor(sid, px, py);
      const wait = start + (dur * i) / steps - Date.now();
      if (wait > 0) await sleep(wait);
    }
  }
  async click(sid, x, y, { dur, pause = 120, mods = [], say } = {}) {
    if (say) this.say(say);
    await this.move(sid, x, y, dur);
    await sleep(pause);
    if (sid === 'canvas') { this.tl.clicks.push([this.now(), sid]); return; }
    const page = this.cdp[sid].page;
    for (const m of mods) await page.keyboard.down(m);
    this.tl.clicks.push([this.now(), sid]);
    await page.mouse.down();
    await sleep(70);
    await page.mouse.up();
    for (const m of mods) await page.keyboard.up(m);
  }
  async box(sid, sel) {
    const page = this.cdp[sid].page;
    const b = await page.locator(sel).first().boundingBox();
    if (!b) throw new Error('no box for ' + sel);
    return b;
  }
  /** Bounding box of the text inside the first `sel` element containing `text` (a Range, not the block). */
  async textBox(sid, sel, text) {
    const page = this.cdp[sid].page;
    const b = await page.evaluate(([sel, text]) => {
      const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.includes(text));
      if (!el) return null;
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        const i = n.textContent.indexOf(text);
        if (i > -1) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + text.length); const b = r.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; }
      }
      return null;
    }, [sel, text]);
    if (!b) throw new Error('no text ' + text);
    return b;
  }
  async selectText(sid, sel, text, dur = 900, say) {
    const b = await this.textBox(sid, sel, text);
    if (say) this.say(say, 2600);
    this.ring(sid, b, dur + 900);
    await this.drag(sid, b.x + 1, b.y + b.height / 2, b.x + b.width - 1, b.y + b.height / 2, { dur });
    return b;
  }
  async clickOn(sid, sel, o = {}) {
    const b = await this.box(sid, sel);
    const fx = o.fx ?? 0.5, fy = o.fy ?? 0.5;
    const r = o.ring === false ? null : this.ring(sid, b);
    await this.click(sid, b.x + b.width * fx, b.y + b.height * fy, o);
    if (r) r.end = this.now() + 450;
    return b;
  }
  async hoverOn(sid, sel, o = {}) {
    const b = await this.box(sid, sel);
    if (o.say) this.say(o.say);
    if (o.ring) this.ring(sid, b, o.ringDur || 1300);
    await this.move(sid, b.x + b.width * (o.fx ?? 0.5), b.y + b.height * (o.fy ?? 0.5), o.dur);
    return b;
  }
  async drag(sid, x1, y1, x2, y2, { dur, hold = 150, say } = {}) {
    if (say) this.say(say, 3200);
    const page = this.cdp[sid].page;
    await this.move(sid, x1, y1);
    await sleep(hold);
    this.tl.clicks.push([this.now(), sid]);
    await page.mouse.down();
    await sleep(120);
    await this.move(sid, x2, y2, dur);
    await sleep(120);
    await page.mouse.up();
  }
  async type(sid, text, cps = 17, say) {
    if (say) this.say(say, Math.min(4000, (Array.from(text).length / cps) * 1000 + 600));
    const page = this.cdp[sid].page;
    const base = 1000 / cps;
    text = Array.from(text); // whole characters (emoji are two UTF-16 units)
    for (let i = 0; i < text.length; i++) {
      await page.keyboard.type(text[i]);
      let d = base * (0.45 + noise(i + text.length * 3) * 1.1);
      if (' .,:—→'.includes(text[i])) d += noise(i * 7) > 0.6 ? base * 3 : base * 0.5;
      await sleep(d);
    }
  }
  async press(sid, key, label, say) {
    if (say) this.say(say, 1600);
    if (label) this.keys(label, 900);
    await this.cdp[sid].page.keyboard.press(key);
  }

  /** Click the extension icon in the (mock) browser toolbar and show the popup. */
  async openPopupUI(pp, { reload = true, say = 'Click the Page Notes icon' } = {}) {
    if (say) this.say(say, 2200);
    this.ring('canvas', { x: G.iconX - 14, y: G.iconY - 14, width: 28, height: 28 }, 1300);
    await this.click('canvas', G.iconX, G.iconY);
    if (reload) {
      await pp.reload();
      await sleep(380);
    }
    this.popup(true);
    await sleep(250);
  }
  closePopupUI() { this.popup(false); }
  /** Camera centered on a popup point. */
  camPop(x, y, z, dur = 900) { this.tl.cams.push({ t: this.now(), x, y, z, dur, space: 'popup' }); }

  /** Send a message to the content script of the tab showing `url` (= what a shortcut would do). */
  async toTab(urlPart, msg) {
    return this.sw.evaluate(async ([u, m]) => {
      const tabs = await chrome.tabs.query({});
      const t = tabs.find((x) => (x.url || '').includes(u));
      return t ? chrome.tabs.sendMessage(t.id, m).catch(() => null) : null;
    }, [urlPart, msg]);
  }
  async shortcut(urlPart, keys, msg, say) {
    if (say) this.say(say, 2000);
    this.keys(keys);
    await sleep(320);
    await this.toTab(urlPart, msg);
  }

  /** Poll the toolbar badge of the main tab. */
  watchBadge(urlFn) {
    let last = null;
    this._badge = setInterval(async () => {
      try {
        const u = urlFn();
        const n = await this.sw.evaluate(async (u) => {
          const tabs = await chrome.tabs.query({});
          const t = tabs.find((x) => (x.url || '').startsWith(u));
          return t ? chrome.action.getBadgeText({ tabId: t.id }) : '';
        }, u);
        if (n !== last) { last = n; this.tl.badge.push([this.now(), n ? +n : 0]); }
      } catch (e) {}
    }, 150);
  }

  /** Open the popup in its own window (so the page tab stays the active tab for snapshots). */
  async openPopup(urlPart) {
    const url = this.ext('popup.html?for=' + encodeURIComponent(urlPart));
    const wait = this.ctx.waitForEvent('page', (p) => p.url().includes('popup.html'));
    await this.sw.evaluate((u) => chrome.windows.create({ url: u, type: 'popup', width: 400, height: 680, left: 0, top: 0 }), url);
    const pp = await wait;
    await pp.setViewportSize(POP);
    await pp.waitForLoadState('load');
    await sleep(500);
    this._pp = pp;
    return pp;
  }
  async popupFor(pp, urlPart) {
    await pp.goto(this.ext('popup.html?for=' + encodeURIComponent(urlPart)));
    await sleep(300);
  }

  async finish(extra = {}) {
    clearInterval(this._badge);
    this.tl.duration = this.now();
    await this.stopAll();
    await sleep(300);
    Object.assign(this.tl, extra);
    // encode each surface: frame durations from timestamps → CFR 30 fps H.264
    for (const [sid, s] of Object.entries(this.cdp)) {
      const fr = s.frames.filter((f) => f[0] >= -5000).sort((a, b) => a[0] - b[0]);
      if (!fr.length) continue;
      const start = Math.max(0, fr[0][0]);
      let list = '';
      for (let i = 0; i < fr.length; i++) {
        const end = i + 1 < fr.length ? fr[i + 1][0] : this.tl.duration;
        const d = Math.max(1, end - Math.max(fr[i][0], start)) / 1000;
        list += `file '${fr[i][1].replace(/\\/g, '/')}'\nduration ${d.toFixed(4)}\n`;
      }
      list += `file '${fr[fr.length - 1][1].replace(/\\/g, '/')}'\n`;
      const lf = path.join(this.dir, sid + '.txt');
      fs.writeFileSync(lf, list);
      const out = path.join(this.dir, `${this.name}-${sid}.mp4`);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lf, '-vf', 'fps=30,format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-tune', 'stillimage', '-g', '15', '-movflags', '+faststart', out]);
      this.tl.surfaces[sid].start = start;
      this.tl.surfaces[sid].file = path.basename(out);
    }
    // thin the cursor track (~40/s)
    const c = [];
    for (const p of this.tl.cursor) if (!c.length || p[0] - c[c.length - 1][0] >= 24 || p[1] !== c[c.length - 1][1]) c.push(p);
    this.tl.cursor = c;
    fs.writeFileSync(path.join(this.dir, this.name + '.json'), JSON.stringify(this.tl));
    return this.tl;
  }
}

/** Build realistic notes on every site through the real UI (snapshots included), then backdate them. */
async function prep(env, list) {
  const page = await env.ctx.newPage();
  const send = (u, m) => env.sw.evaluate(async ([u, m]) => { const t = (await chrome.tabs.query({})).find((x) => (x.url || '').includes(u)); return t && chrome.tabs.sendMessage(t.id, m).catch(() => null); }, [u, m]);
  for (const site of list) {
    await page.goto(site.url, { waitUntil: 'load' });
    await sleep(site.wait || 900);
    if (site.scroll) await page.evaluate((y) => scrollTo(0, y), site.scroll);
    for (const n of site.notes) {
      if (n.hl) {
        await send(site.url, { type: 'place', mode: 'hl' });
        await sleep(300);
        const b = await page.locator(n.hl).first().boundingBox();
        await page.mouse.move(b.x + 2, b.y + b.height / 2);
        await page.mouse.down();
        await page.mouse.move(b.x + b.width - 2, b.y + b.height / 2, { steps: 8 });
        await page.mouse.up();
      } else {
        await send(site.url, { type: 'place', mode: n.el ? 'el' : 'free' });
        await sleep(300);
        await page.mouse.move(n.x, n.y);
        await sleep(150);
        await page.mouse.click(n.x, n.y);
      }
      await sleep(900);
      await page.keyboard.type(n.text, { delay: 4 });
      await sleep(250);
      await page.mouse.click(5, 700);
      await sleep(900); // snapshot
    }
  }
  // tweak: colors / done / urgent / age, straight in storage
  await env.sw.evaluate(async (list) => {
    const all = await chrome.storage.local.get(null);
    const now = Date.now();
    for (const k of Object.keys(all)) {
      if (!k.startsWith('p:')) continue;
      const p = all[k];
      const site = list.find((s) => k.includes(new URL(s.url).host));
      if (!site) continue;
      p.notes.forEach((n, i) => {
        const o = site.notes[i] || {};
        if (o.color) n.color = o.color;
        if (o.done) n.done = true;
        if (o.urgent) n.pri = 'urgent';
        const age = (o.age ?? site.age ?? 0) * 3600e3;
        n.createdAt = n.updatedAt = now - age - i * 60e3;
      });
      p.updatedAt = now - (site.age || 0) * 3600e3;
      await chrome.storage.local.set({ [k]: p });
    }
  }, list.map((s) => ({ url: s.url, age: s.age, notes: s.notes.map((n) => ({ color: n.color, done: n.done, urgent: n.urgent, age: n.age })) })));
  await page.close();
}

module.exports = { launch, Studio, prep, sleep, VIEW, POP, G, toCanvas };
