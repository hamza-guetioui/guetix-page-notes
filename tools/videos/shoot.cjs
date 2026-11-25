/* Screenplays: one function per video. Usage: node shoot.cjs <video-id> */
const { launch, Studio, prep, sleep } = require('./studio.cjs');
const { FULL, T, C } = require('./data.cjs');
const fs = require('fs');
require('./prepare-ext.cjs')();

const R = 'gx-page-notes';
const D = `${R} .dock`;
const SITES = {
  dash: { url: 'http://app.pulse.io/', show: 'app.pulse.io/acme/overview', title: 'Overview · Acme · Pulse', fav: '#4f46e5' },
  shop: { url: 'http://shoply.com/', show: 'shoply.com/p/aurora-x2', title: 'Aurora X2 Headphones · Shoply', fav: '#f59e0b' },
  video: { url: 'http://streamly.tv/', show: 'streamly.tv/watch?v=productive', title: 'How to Be So Productive it Feels Illegal · Streamly', fav: '#ff0033' },
  home: { url: 'http://guetix.com/', show: 'guetix.com', title: 'Guetix · Hamza Guetioui', fav: '#22c55e', wait: 5200 },
  docs: { url: 'http://guetix.com/extensions/page-notes-extension', show: 'guetix.com/extensions/page-notes-extension', title: 'Page Notes Extension · Guetix UI', fav: '#22c55e', wait: 3500 },
};
const showTab = (S, k, extra = {}) => S.tab({ url: SITES[k].show, title: SITES[k].title, fav: SITES[k].fav, ...extra });

async function setup(name, { data = [], settings, start = 'dash' } = {}) {
  const env = await launch({ profile: require('path').join(require('os').tmpdir(), 'page-notes-videos', 'prof-' + name) });
  if (data.length) await prep(env, data);
  await env.sw.evaluate((s) => chrome.storage.local.get('settings').then((r) => chrome.storage.local.set({ settings: Object.assign({}, r.settings || {}, { tips: undefined }, s || {}) })), settings || {});
  const S = new Studio(env, name);
  const page = await env.ctx.newPage();
  for (const p of env.ctx.pages()) if (p !== page) await p.close().catch(() => {});
  env.ctx.on('page', async (p) => {
    // tabs the extension opens (All notes, settings, links): we show them in the main tab instead
    await sleep(50);
    if (p !== page && !p.url().includes('popup.html')) S._opened = p.url();
  });
  if (start === 'notes') await load(page, env.ext('notes.html'), 1200);
  else if (start === 'settings') await load(page, env.ext('notes.html#settings'), 1200);
  else if (start) await load(page, SITES[start].url, SITES[start].wait || 1000);
  return { env, S, page };
}

const HIDE_DEV = 'nextjs-portal{display:none!important}';
async function load(page, url, wait = 900) {
  await page.goto(url, { waitUntil: 'load' });
  if (url.includes('guetix.com')) await page.addStyleTag({ content: HIDE_DEV }).catch(() => {});
  await sleep(wait);
}
async function go(S, page, k, extra) {
  showTab(S, k, extra);
  S.cutStart();
  await load(page, SITES[k].url, (SITES[k].wait || 900) - 300);
  S.cutEnd();
  await sleep(300);
}

const center = (b) => [b.x + b.width / 2, b.y + b.height / 2];

/* ───────────────────────── videos ───────────────────────── */

const VIDEOS = {};

VIDEOS.toolbar = async () => {
  const { env, S, page } = await setup('toolbar', { data: [{ url: SITES.dash.url, age: 20, notes: [{ x: 300, y: 380, text: T.d1 }] }], settings: { tips: true } });
  S.start();
  await S.attach('main', page, { width: 1440, height: 720 });
  showTab(S, 'dash');
  S.watchBadge(() => 'http://app.pulse.io');
  S.logCursor('main', 700, 380);
  await page.mouse.move(700, 380);

  S.chapter('Meet the toolbar', 'It shows up in the corner of any page with notes: the count, ‹ › to step through them, + Note, and a few handy buttons.');
  await sleep(900);
  const dock = await S.box('main', D);
  S.cam(dock.x + dock.width / 2 - 60, dock.y - 60, 2.2, 1100);
  await sleep(700);
  await S.hoverOn('main', `${D} .brand`, { say: "The logo shows how many notes are on this page", ring: true });
  await sleep(700);
  await S.hoverOn('main', `${D} .nav .pos`, { say: "‹ › step through the notes", ring: true });
  await sleep(700);
  await S.hoverOn('main', `${D} .split .new`, { say: "+ Note adds a new one", ring: true });
  await sleep(700);
  await S.hoverOn('main', `${D} .eye`, { say: "The eye hides this page's notes", ring: true });
  await sleep(500);
  await S.hoverOn('main', `${D} button[title="Options"]`, { say: "Options: more actions and switches", ring: true });
  await sleep(500);
  await S.hoverOn('main', `${D} button[title^="Close"]`, { say: "✕ closes the toolbar", ring: true });
  await sleep(600);

  S.chapter('Add a note', 'Click + Note, then click anywhere on the page. A short guide shows the tricks while you place it.');
  await S.clickOn('main', `${D} .split .new`, { say: "Click + Note" });
  await sleep(500);
  S.cam(1180, 560, 1.7, 900);
  S.say('A guide card shows the tricks while you place it', 2400);
  await sleep(2200);
  S.wide(900);
  S.say('Click where the note should go');
  await S.move('main', 760, 420, 1200);
  await sleep(300);
  S.cam(860, 470, 1.6, 900);
  await S.click('main', 760, 420);
  await sleep(500);
  await S.type('main', 'Ask Sam why the chart spikes on Nov 1.', 17, "Type your note");
  await sleep(700);
  await S.click('main', 1200, 120, { say: "Click outside to finish", dur: 700 });
  S.wide(900);
  await sleep(800);

  S.chapter('Pick the type of note', 'The arrow next to + Note lets you choose: a free note, a note stuck to an element, or a text highlight.');
  S.cam(dock.x + dock.width / 2 - 80, dock.y - 110, 1.9, 900);
  await S.clickOn('main', `${D} .split .caret`, { say: "Click the arrow next to + Note" });
  await sleep(1300);
  await S.hoverOn('main', `${D} .menu.open button[role=menuitem] >> nth=1`, { say: "Element: sticks to a card, button or image", ring: true });
  await sleep(900);
  await S.clickOn('main', `${D} .menu.open button[role=menuitem] >> nth=1`, { say: "Choose Element" });
  S.wide(900);
  await sleep(500);
  const nps = await S.box('main', '#k-nps');
  S.cam(nps.x + nps.width / 2 - 120, nps.y + 160, 1.55, 1000);
  S.say('Hover a card: it gets outlined');
  await S.move('main', nps.x + 80, nps.y + 60, 1100);
  await sleep(500);
  await S.move('main', nps.x + 200, nps.y + 80, 700);
  await sleep(500);
  await S.click('main', nps.x + 200, nps.y + 80, { say: "Click the card to stick the note to it" });
  await sleep(500);
  await S.type('main', 'NPS jumped — thank the support team!', 17, "Type your note");
  await sleep(600);
  await S.click('main', 1200, 640, { say: "Click outside to finish", dur: 700 });
  S.wide(900);
  await sleep(700);

  S.chapter('Highlight text', 'Choose Text, select a few words, and they get highlighted with a note right next to them.');
  await S.clickOn('main', `${D} .split .caret`, { say: "Open the menu again" });
  await sleep(800);
  await S.clickOn('main', `${D} .menu.open button[role=menuitem] >> nth=2`, { say: "Choose Text" });
  await sleep(700);
  const h = await S.textBox('main', 'h3', 'Top channels');
  S.cam(h.x + 160, h.y + 90, 1.7, 1000);
  await S.move('main', h.x - 30, h.y + 40, 900);
  await sleep(500);
  await S.selectText('main', 'h3', 'Top channels', 900, "Select the words to highlight");
  await sleep(700);
  await S.type('main', 'Paid ads at 27% — budget review Friday.', 17, "Type a note for the highlight");
  await sleep(700);
  await S.click('main', 700, 660, { say: "Click outside to finish", dur: 700 });
  S.wide(900);
  await sleep(700);

  S.chapter('Switch while placing', 'Already placing? Press N for a note, E for an element, T for text. Esc cancels.');
  await S.clickOn('main', `${D} .split .new`, { say: "Click + Note to start placing" });
  await sleep(400);
  S.cam(1140, 560, 1.6, 800);
  await S.move('main', 900, 470, 800);
  await sleep(700);
  await S.press('main', 'e', ['E'], "Press E: element");
  await S.move('main', 760, 200, 700);
  await sleep(900);
  await S.press('main', 'n', ['N'], "Press N: free note");
  await S.move('main', 860, 450, 700);
  await sleep(900);
  await S.press('main', 't', ['T'], "Press T: text");
  await S.move('main', 900, 470, 500);
  await sleep(900);
  await S.press('main', 'Escape', ['Esc'], "Press Esc to cancel");
  await sleep(900);
  S.wide(900);
  await sleep(300);

  S.chapter('Drag a note off the toolbar', 'Grab + Note and drop it exactly where you want it — the note is created right there.');
  S.cam(dock.x + dock.width / 2 - 80, dock.y - 110, 1.9, 900);
  await S.clickOn('main', `${D} .split .caret`, { say: "Open the menu" });
  await sleep(800);
  await S.clickOn('main', `${D} .menu.open button[role=menuitem] >> nth=0`, { say: "Choose Note" });
  await sleep(900);
  await S.press('main', 'Escape', ['Esc'], "Esc — we'll drag one instead");
  await sleep(700);
  S.cam(1000, 520, 1.25, 1000);
  const nb = await S.box('main', `${D} .split .new`);
  await S.drag('main', nb.x + nb.width / 2, nb.y + nb.height / 2, 560, 560, { say: "Drag + Note onto the page and let go", dur: 1400 });
  await sleep(700);
  await S.type('main', 'Export this for the Monday meeting.', 17, "Type your note");
  await sleep(600);
  await S.click('main', 1250, 120, { say: "Click outside to finish", dur: 700 });
  S.wide(900);
  await sleep(600);

  S.chapter('Step through your notes', 'Use ‹ › to jump from note to note — handy on long pages.');
  S.cam(dock.x + dock.width / 2 - 200, dock.y - 160, 1.25, 900);
  for (let i = 0; i < 4; i++) {
    await S.clickOn('main', `${D} .nav button >> nth=1`, { say: "Click › for the next note", dur: i ? 250 : 700 });
    await sleep(1000);
  }
  await S.clickOn('main', `${D} .nav button >> nth=0`, { say: "Click ‹ to go back", dur: 300 });
  await sleep(1000);
  S.wide(900);

  S.chapter('Hide this page’s notes', 'The eye hides the notes on this page only (Alt+Shift+H). Click again to bring them back.');
  await S.clickOn('main', `${D} .eye`, { say: "Click the eye to hide the notes" });
  await sleep(1600);
  await S.clickOn('main', `${D} .eye`, { say: "Click it again to show them" });
  await sleep(1300);

  S.chapter('Options', 'All my notes, copy this page’s notes as text, delete all here, settings — and quick switches.');
  S.cam(dock.x + dock.width / 2 - 120, dock.y - 170, 1.75, 900);
  await S.clickOn('main', `${D} button[title="Options"]`, { say: "Click Options" });
  await sleep(900);
  const items = await page.locator(`${D} .menu.open button[role=menuitem]`).count();
  for (let i = 0; i < items; i++) {
    await S.hoverOn('main', `${D} .menu.open button[role=menuitem] >> nth=${i}`, { dur: 380 });
    await sleep(650);
  }
  await S.hoverOn('main', `${D} .menu.open label >> nth=0`, { say: "Show or hide this page's notes", ring: true, dur: 400 });
  await sleep(800);
  await S.hoverOn('main', `${D} .menu.open label >> nth=1`, { say: "Turn tips on or off", ring: true, dur: 300 });
  await sleep(800);
  await S.click('main', 700, 120, { say: "Click outside to close", dur: 700 });
  S.wide(900);
  await sleep(600);

  S.chapter('Move it anywhere', 'Drag the toolbar by its logo — it snaps to the nearest side and stays there.');
  const br = await S.box('main', `${D} .brand`);
  await S.drag('main', br.x + br.width / 2, br.y + br.height / 2, 240, 690, { say: "Drag the toolbar by its logo", dur: 1400 });
  await sleep(1300);
  const br2 = await S.box('main', `${D} .brand`);
  await S.drag('main', br2.x + br2.width / 2, br2.y + br2.height / 2, 1300, 690, { say: "Drag it back — it snaps to the side", dur: 1400 });
  await sleep(1200);

  S.chapter('Minimize or close', 'Click the logo to fold it to a tiny icon. ✕ closes it until your next new note — your notes stay.');
  const d2 = await S.box('main', D);
  S.cam(d2.x + d2.width / 2 - 80, d2.y - 60, 2, 900);
  await S.clickOn('main', `${D} .brand`, { say: "Click the logo to minimize" });
  await sleep(1500);
  await S.clickOn('main', `${D} .brand`, { say: "Click it again to expand" });
  await sleep(1300);
  await S.clickOn('main', `${D} button[title^="Close"]`, { say: "✕ closes it until your next note" });
  await sleep(1600);
  S.wide(900);
  await sleep(1400);

  await S.finish();
  await env.ctx.close();
};

module.exports = { VIDEOS, SITES, setup, go, load, showTab, center, R, D };
require('./shoot2.cjs');

if (require.main === module) {
  const id = process.argv[2];
  VIDEOS[id]().then(() => console.log('done', id)).catch((e) => { console.error(e); process.exit(1); });
}
