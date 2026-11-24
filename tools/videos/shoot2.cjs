/* Screenplays (continued): extension bar, note options, all notes, settings, how it works. */
const { VIDEOS, SITES, setup, go, load, showTab, R, D } = require('./shoot.cjs');
const { sleep } = require('./studio.cjs');
const { FULL, T, C } = require('./data.cjs');

const NOTES_TAB = { url: 'chrome-extension://page-notes/notes.html', title: 'All notes · Page Notes', fav: '#ff5b14' };
const SETTINGS_TAB = { url: 'chrome-extension://page-notes/notes.html#settings', title: 'Settings · Page Notes', fav: '#ff5b14' };
const fakeClick = (S, sid) => S.tl.clicks.push([S.now(), sid]);

/* ───────────── The extension bar (toolbar popup) ───────────── */
VIDEOS['extension-bar'] = async () => {
  const { env, S, page } = await setup('extension-bar', { data: FULL, start: 'dash' });
  const pp = await S.openPopup('app.pulse.io');
  S.start();
  await S.attach('main', page, { width: 1440, height: 720 });
  await S.attach('popup', pp, { width: 380, height: 600 });
  showTab(S, 'dash');
  S.watchBadge(() => 'http://app.pulse.io');
  S.logCursor('main', 640, 420);
  await page.mouse.move(640, 420);
  const P = 'popup';

  S.chapter('Open it from the toolbar', 'Pin Page Notes next to the address bar. The badge counts the notes on the page you are on.');
  await sleep(1200);
  S.cam(1110, 90, 2.2, 1000, 'canvas');
  S.tl.cams[S.tl.cams.length - 1].space = 'canvas';
  await sleep(1300);
  await S.openPopupUI(pp);
  S.camPop(190, 230, 1.55, 900);
  await sleep(1500);

  S.chapter('Your notes at a glance', 'This page, this site, and everywhere — tap a tile to see those notes.');
  await S.hoverOn(P, '#sPage', { say: "This page: notes on the page you're on", ring: true });
  await sleep(1100);
  await S.hoverOn(P, '#sSite', { say: "This site: every page of this site", ring: true });
  await sleep(1100);
  await S.hoverOn(P, '#all', { say: "Everywhere: all your notes", ring: true });
  await sleep(1300);

  S.chapter('Every site you noted', 'The sites menu lists every site with notes, with counts. Pick one to look at its notes.');
  S.camPop(220, 160, 1.7, 800);
  await S.clickOn(P, '#siteBtn', { say: "Click the sites menu" });
  await sleep(1300);
  const items = await pp.locator('#siteMenu li button, #siteMenu li[role=option], #siteMenu [role=option]').count();
  for (let i = 0; i < Math.min(items, 5); i++) {
    await S.hoverOn(P, `#siteMenu [role=option] >> nth=${i}`, { dur: 380 });
    await sleep(450);
  }
  await S.clickOn(P, '#siteMenu [role=option]:has-text("guetix.com")', { say: "Pick a site to see its notes" });
  await sleep(1600);
  S.camPop(190, 300, 1.45, 800);
  await sleep(1400);
  await S.clickOn(P, '#siteBtn', { say: "Open it again" });
  await sleep(900);
  await S.clickOn(P, '#siteMenu [role=option]:has-text("app.pulse.io")', { say: "Back to this site" });
  await sleep(1200);

  S.chapter('This page · This site · Recent', 'Three lists in one place: notes here, on the whole site, or your latest anywhere.');
  S.camPop(190, 330, 1.5, 800);
  await S.clickOn(P, '#t-site', { say: "This site" });
  await sleep(1500);
  await S.clickOn(P, '#t-recent', { say: "Recent: your latest notes anywhere" });
  await sleep(1800);
  await S.clickOn(P, '#t-page', { say: "This page" });
  await sleep(1300);

  S.chapter('Quick filters', 'Urgent, open, done, highlights, links — one tap filters the list.');
  S.camPop(190, 300, 1.7, 800);
  for (const q of ['urgent', 'open', 'done', 'all']) {
    await S.clickOn(P, `#quick button[data-q="${q}"]`, { say: "Tap a filter", dur: 420 });
    await sleep(1100);
  }

  S.chapter('Mark it done from the list', 'The Open / Done button saves right away — the note on the page updates live.');
  S.cam(860, 330, 1.05, 900);
  await S.clickOn(P, '#list .card >> nth=0 >> .c-st', { say: "Click Open to mark the note done" });
  await sleep(2000);
  await S.clickOn(P, '#list .card >> nth=0 >> .c-st', { say: "Click again to reopen it" });
  await sleep(1500);

  S.chapter('Jump to a note', 'Click a card to scroll the page to that note — it pulses so you can’t miss it.');
  await S.clickOn(P, '#list .card >> nth=0 >> .txt', { say: "Click a card to jump to that note" });
  await sleep(250);
  S.closePopupUI();
  S.wide(900);
  await sleep(2600);

  S.chapter('New note in one click', '+ New note closes the popup and you place the note on the page.');
  await S.openPopupUI(pp);
  S.camPop(190, 470, 1.6, 800);
  await sleep(900);
  await S.clickOn(P, '#add', { say: "Click + New note" });
  await sleep(200);
  S.closePopupUI();
  S.wide(800);
  await sleep(700);
  await S.move('main', 520, 560, 1000);
  await S.click('main', 520, 560, { say: "Click where the note should go" });
  await sleep(500);
  await S.type('main', 'Share this chart in the weekly report.', 17, "Type your note");
  await sleep(600);
  await S.click('main', 1300, 120, { say: "Click outside to finish", dur: 700 });
  await sleep(700);

  S.chapter('Show or hide this page’s notes', 'The switch at the bottom hides the notes on this page only — nothing is deleted.');
  await S.openPopupUI(pp);
  S.camPop(160, 560, 1.15, 800);
  await sleep(900);
  await S.clickOn(P, '#show', { say: "Switch off: this page's notes hide", fx: 0.5 });
  await sleep(2000);
  await S.clickOn(P, '#show', { say: "Switch on: they're back", fx: 0.5 });
  await sleep(1500);

  S.chapter('Tips, colors and language', 'Open “Tips & colors” for the shortcuts. The popup speaks 10 languages.');
  S.camPop(190, 470, 1.6, 800);
  await S.clickOn(P, '#guide summary', { say: "Open Tips & colors", fx: 0.2 });
  await sleep(2400);
  await S.clickOn(P, '#guide summary', { say: "Close it", fx: 0.2 });
  await sleep(700);
  S.camPop(250, 500, 1.6, 800);
  await S.clickOn(P, '#langBtn', { say: "Click the language button" });
  await sleep(1300);
  await S.clickOn(P, '#langMenu [role=option]:has-text("Français")', { say: "Pick a language" });
  await sleep(1300);
  S.camPop(190, 300, 1.4, 800);
  await sleep(1800);
  await S.clickOn(P, '#langBtn', { say: "Open it again" });
  await sleep(900);
  await S.clickOn(P, '#langMenu [role=option]:has-text("English")', { say: "Back to English" });
  await sleep(1200);

  S.chapter('All notes and settings', 'The gear opens Settings. “All notes” opens the full list of every note.');
  S.camPop(250, 560, 1.6, 800);
  await S.hoverOn(P, '#settings', { say: "The gear opens Settings", ring: true });
  await sleep(1200);
  S.camPop(250, 240, 1.6, 800);
  await S.hoverOn(P, '#allTop', { say: "All notes opens the full list", ring: true });
  await sleep(700);
  await S.clickOn(P, '#allTop', { say: "Click All notes" });
  await sleep(200);
  S.closePopupUI();
  S.wide(700);
  S.tab(NOTES_TAB);
  S.cutStart();
  await load(page, env.ext('notes.html'), 300);
  S.cutEnd();
  await sleep(2600);

  await S.finish();
  await env.ctx.close();
};

/* ───────────── Note options (on the new guetix.com) ───────────── */
VIDEOS['note-options'] = async () => {
  const data = [{ url: SITES.home.url, wait: 5000, age: 20, notes: [{ x: 1010, y: 520, text: T.g3, color: C.G, done: true }] }];
  const { env, S, page } = await setup('note-options', { data, start: 'home' });
  S.start();
  await S.attach('main', page, { width: 1440, height: 720 });
  showTab(S, 'home');
  S.watchBadge(() => 'http://guetix.com');
  S.logCursor('main', 640, 420);
  await page.mouse.move(640, 420);
  const N = (i, sel = '') => `${R} .gxn-note >> nth=${i}` + (sel ? ` >> ${sel}` : '');
  const btn = (i, label) => N(i, `button[aria-label="${label}"]`);

  S.chapter('A note on any page', 'Reviewing a site — here, guetix.com? Click + Note, click the spot, type. Links turn into chips.');
  await sleep(1000);
  await S.clickOn('main', `${D} .split .new`, { say: "Click + Note" });
  await sleep(600);
  await S.move('main', 760, 300, 1100);
  await sleep(300);
  S.cam(860, 360, 1.5, 900);
  await S.click('main', 760, 300, { say: "Click the spot" });
  await sleep(600);
  await S.type('main', 'Love this headline. Link it to https://guetix.com/projects ✨', 17, "Type — links become chips");
  await sleep(900);

  S.chapter('Pick a color', 'Four colors, same palette as the Page Notes package.');
  const nb = await S.box('main', N(1));
  S.cam(nb.x + 90, nb.y + 60, 2, 900);
  for (const c of ['#f9a8d4', '#86efac', '#7dd3fc', '#fde047']) {
    await S.clickOn('main', N(1, `button[aria-label="Color ${c}"]`), { say: "Click a color dot", dur: 380 });
    await sleep(800);
  }

  S.chapter('Urgent', '! flags a note as urgent — it gets a red badge here and in your lists.');
  await S.clickOn('main', btn(1, 'Mark as urgent'), { say: "Click ! to mark it urgent" });
  await sleep(2000);

  S.chapter('Done', '✓ marks it done: crossed out and stamped. Click again to reopen.');
  await S.clickOn('main', btn(1, 'Mark as done'), { say: "Click ✓ to mark it done" });
  await sleep(2000);
  await S.clickOn('main', btn(1, 'Mark as done'), { say: "Click ✓ again to reopen" });
  await sleep(1300);

  S.chapter('Link to this note', '# copies a link that opens this page and points straight at the note.');
  await S.clickOn('main', btn(1, 'Copy a link to this note'), { say: "Click # to copy a link to this note" });
  await sleep(2200);

  S.chapter('Fold it away', '– folds the note into a small numbered tab. Click the number to open it again.');
  await S.clickOn('main', btn(1, 'Fold into a tab'), { say: "Click – to fold it" });
  await sleep(1600);
  await S.clickOn('main', N(1, '.gxn-num'), { say: "Click the number to unfold" });
  await sleep(1500);

  S.chapter('Move and resize', 'Drag the top bar to move it, drag the corner to resize. It stays inside the page.');
  S.cam(800, 380, 1.3, 900);
  const b1 = await S.box('main', N(1, '.gxn-bar'));
  await S.drag('main', b1.x + b1.width * 0.62, b1.y + b1.height / 2, b1.x + b1.width * 0.62 - 330, b1.y + 260, { say: "Drag the top bar to move it", dur: 1300 });
  await sleep(900);
  const rs = await S.box('main', N(1, '.gxn-rs'));
  await S.drag('main', rs.x + rs.width / 2, rs.y + rs.height / 2, rs.x + 90, rs.y + 50, { say: "Drag the corner to resize", dur: 1000 });
  await sleep(1200);

  S.chapter('Delete — and undo', '✕ deletes at once. Changed your mind? Undo brings it back.');
  await S.clickOn('main', btn(1, 'Delete note'), { say: "Click ✕ to delete" });
  await sleep(900);
  S.cam(1180, 600, 1.6, 800);
  await sleep(600);
  const undo = page.locator(`${R} .toast button`).first();
  const ub = await undo.boundingBox().catch(() => null);
  if (ub) await S.click('main', ub.x + ub.width / 2, ub.y + ub.height / 2, { say: "Click Undo to bring it back" });
  await sleep(1300);
  S.wide(900);
  await sleep(800);

  S.chapter('They come back', 'Close the tab, come back tomorrow: every note is exactly where you left it.');
  S.tab({ url: 'guetix.com', title: 'New Tab', fav: '#9ca3af' });
  await page.goto('data:text/html,<body style="margin:0;background:%23202124;display:grid;place-items:center;height:100vh;font:600 64px system-ui;color:%23ffffff22">New Tab</body>');
  await sleep(900);
  await go(S, page, 'home');
  await sleep(2500);

  await S.finish();
  await env.ctx.close();
};

/* ───────────── All notes ───────────── */
VIDEOS['all-notes'] = async () => {
  const { env, S, page } = await setup('all-notes', { data: FULL, start: 'notes' });
  S.start();
  await S.attach('main', page, { width: 1440, height: 720 });
  S.tab(NOTES_TAB);
  S.logCursor('main', 720, 420);
  await page.mouse.move(720, 420);

  S.chapter('Every note, in one page', 'All notes shows every note from every site, with a snapshot of where it sits.');
  await sleep(1200);
  await S.move('main', 600, 520, 900);
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, 160);
    await sleep(420);
  }
  await sleep(600);
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, -160);
    await sleep(380);
  }
  await S.hoverOn('main', '#grid .card >> nth=1', { say: "Each card: snapshot, status, text, page", ring: true });
  await sleep(1200);

  S.chapter('Search', 'Search notes, page titles, links and highlighted text.');
  S.cam(560, 200, 1.5, 800);
  await S.clickOn('main', '#q', { say: "Click the search box" });
  await sleep(400);
  await S.type('main', 'churn', 9, "Type what you're looking for");
  await sleep(1800);
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await sleep(700);
  S.wide(800);

  S.chapter('Filter', 'Open, done, urgent, highlights, with links — the counts update as you go. Or filter by color.');
  S.cam(560, 230, 1.45, 800);
  for (const t of ['Open', 'Done', 'Urgent', 'With links', 'All']) {
    await S.clickOn('main', `#tabs button:has-text("${t}")`, { say: "Tap a filter — counts update", dur: 450 });
    await sleep(1000);
  }
  S.cam(1100, 230, 1.6, 700);
  await S.clickOn('main', '#colors button >> nth=1', { say: "Filter by color" });
  await sleep(1300);
  await S.clickOn('main', '#colors button >> nth=1', { say: "Click again to clear it" });
  await sleep(900);
  S.wide(800);

  S.chapter('Site and sort', 'Narrow the list to one site, sort by newest, oldest or site.');
  S.cam(1000, 190, 1.45, 800);
  await S.hoverOn('main', '#site', { say: "Pick a site", ring: true });
  fakeClick(S, 'main');
  await page.selectOption('#site', { index: 2 }).catch(() => {});
  await sleep(1700);
  await page.selectOption('#site', { index: 0 }).catch(() => {});
  fakeClick(S, 'main');
  await sleep(900);
  await S.hoverOn('main', '#sort', { say: "Pick an order", ring: true });
  fakeClick(S, 'main');
  await page.selectOption('#sort', { index: 1 }).catch(() => {});
  await sleep(1500);
  await page.selectOption('#sort', { index: 0 }).catch(() => {});
  fakeClick(S, 'main');
  await sleep(800);
  S.wide(800);

  S.chapter('Open or done, in one click', 'Every card has an Open | Done switch — it updates the note on its page too.');
  S.cam(330, 450, 1.6, 800);
  await S.clickOn('main', '#grid .card >> nth=0 >> .s-done', { say: "Click Done" });
  await sleep(1600);
  await S.clickOn('main', '#grid .card >> nth=0 >> .s-open', { say: "Click Open to reopen" });
  await sleep(1200);

  S.chapter('Edit it like a sticky note', 'Edit opens the note as a sticky note: change the text, the color, done or urgent.');
  await S.clickOn('main', '#grid .card >> nth=0 >> .a-edit', { say: "Click Edit" });
  await sleep(900);
  S.wide(700);
  await sleep(500);
  const et = await S.box('main', '#edText');
  await S.click('main', et.x + et.width - 20, et.y + et.height - 20, { say: "Change the text" });
  await page.keyboard.press('Control+End');
  await S.type('main', ' Ask Sam.', 12);
  await sleep(600);
  await S.clickOn('main', '#edDots button >> nth=3', { say: "Pick a color" });
  await sleep(900);
  await S.clickOn('main', '#edSave', { say: "Click Save" });
  await sleep(1400);

  S.chapter('Select several', 'Select, tick a few cards, then mark them done, urgent, delete — or share them.');
  S.cam(400, 280, 1.4, 800);
  await S.clickOn('main', '#selBtn', { say: "Click Select" });
  await sleep(800);
  for (const i of [0, 1, 2]) {
    await S.clickOn('main', `#grid .card >> nth=${i} >> .txt`, { say: "Tick the cards you want", dur: 500 });
    await sleep(500);
  }
  S.cam(700, 280, 1.45, 800);
  await sleep(900);
  await S.hoverOn('main', '#bDone', { say: "Mark them all done…", ring: true });
  await sleep(700);
  await S.hoverOn('main', '#bUrg', { say: "…or urgent", ring: true });
  await sleep(700);
  await S.clickOn('main', '#shMenuBtn', { say: "Share ▾ — download or copy them" });
  await sleep(1300);
  await S.hoverOn('main', '#shDl');
  await sleep(600);
  await S.hoverOn('main', '#shCopy');
  await sleep(700);
  await S.clickOn('main', '#shMenuBtn', { say: "Close the menu" });
  await sleep(500);
  await S.clickOn('main', '#selClear', { say: "Clear the selection" });
  await sleep(500);
  await S.clickOn('main', '#selBtn', { say: "Leave select mode" });
  await sleep(800);
  S.wide(800);

  S.chapter('Back to the page', 'The arrow opens the page and scrolls right to that note.');
  S.cam(330, 560, 1.5, 800);
  await S.clickOn('main', '#grid .card >> nth=3 >> .pg .ico', { say: "Click → to open the note on its page" });
  await sleep(300);
  S.wide(700);
  const href = S._opened;
  const target = href && href.includes('guetix.com') ? 'home' : href && href.includes('streamly') ? 'video' : href && href.includes('shoply') ? 'shop' : 'dash';
  showTab(S, target);
  S.cutStart();
  await load(page, href || SITES[target].url, (SITES[target].wait || 1200) - 400);
  S.cutEnd();
  await sleep(3200);

  await S.finish();
  await env.ctx.close();
};

/* ───────────── Settings ───────────── */
VIDEOS.settings = async () => {
  const { env, S, page } = await setup('settings', { data: FULL, start: 'notes' });
  S.start();
  await S.attach('main', page, { width: 1440, height: 720 });
  S.tab(NOTES_TAB);
  S.logCursor('main', 720, 420);
  await page.mouse.move(720, 420);
  const opt = (key, val) => `.opts[data-key="${key}"] .opt[data-val="${val}"]`;
  const scrollTo = async (sel) => {
    await page.locator(sel).first().evaluate((e) => e.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await sleep(900);
  };

  S.chapter('Open settings', 'Settings live next to All notes — one page, two tabs. (Also from the popup’s gear.)');
  await sleep(900);
  S.cam(720, 60, 1.8, 800);
  await S.clickOn('main', '#navSettings', { say: "Click Settings" });
  S.tab(SETTINGS_TAB);
  await sleep(1300);
  S.wide(800);
  await sleep(900);

  S.chapter('Notes on pages', 'Turn every note off at once, or show notes only when you open Page Notes.');
  await scrollTo('#visible');
  S.cam(720, 360, 1.25, 800);
  await S.clickOn('main', '#visible', { say: "Turn notes off everywhere — options lock" });
  await sleep(1800);
  await S.clickOn('main', '#visible', { say: "Turn them back on" });
  await sleep(1000);
  await S.clickOn('main', opt('notesWhen', 'click'), { say: "Show notes only when you open Page Notes" });
  await sleep(1400);
  await S.clickOn('main', opt('notesWhen', 'auto'), { say: "Or right away (default)" });
  await sleep(900);

  S.chapter('The toolbar', 'When needed, always small, or hidden. Its position can be reset here.');
  await scrollTo(opt('dock', 'mini'));
  await S.clickOn('main', opt('dock', 'mini'), { say: "Choose Always, small" });
  await sleep(1200);
  // see it on a page
  showTab(S, 'dash');
  S.cutStart();
  await load(page, SITES.dash.url, 700);
  S.cutEnd();
  S.cam(1250, 640, 2, 800);
  await sleep(1300);
  await S.clickOn('main', `${D} .brand`, { say: "A tiny icon — click to expand" });
  await sleep(1600);
  S.wide(700);
  S.tab(SETTINGS_TAB);
  S.cutStart();
  await load(page, env.ext('notes.html#settings'), 600);
  S.cutEnd();
  await scrollTo(opt('dock', 'auto'));
  await S.clickOn('main', opt('dock', 'auto'), { say: "Back to When needed" });
  await sleep(900);
  await S.hoverOn('main', '#resetPos', { say: "Reset the toolbar position", ring: true });
  await sleep(900);

  S.chapter('Help & messages', 'Tips while you place notes, the guide style, and the Undo bar after deleting.');
  await scrollTo('#tips');
  await S.clickOn('main', '#tips', { say: "Tips on pages" });
  await sleep(900);
  await S.clickOn('main', opt('guideMode', 'compact'), { say: "Compact guide: just a ? to click" });
  await sleep(1100);
  await S.clickOn('main', opt('guideMode', 'full'), { say: "Full guide" });
  await sleep(800);
  await S.hoverOn('main', '#undo', { say: "Undo bar after deleting", ring: true });
  await sleep(900);

  S.chapter('Language and snapshots', 'Pick one of 10 languages. Snapshots keep a small picture of each spot for your list.');
  await scrollTo('#lang');
  await S.hoverOn('main', '#lang', { say: "Pick a language", ring: true });
  fakeClick(S, 'main');
  const langs = await page.locator('#lang option').evaluateAll((o) => o.map((x) => x.value));
  const fr = langs.find((v) => v === 'fr') || langs[2];
  await page.selectOption('#lang', fr).catch(() => {});
  await sleep(2300);
  fakeClick(S, 'main');
  await page.selectOption('#lang', langs[0]).catch(() => {});
  await sleep(1200);
  await S.hoverOn('main', '#snapshots', { say: "Snapshots for your list", ring: true });
  await sleep(900);

  S.chapter('Keyboard shortcuts', 'See your shortcuts, and change them in Chrome’s shortcuts page.');
  await scrollTo('#keys');
  await S.move('main', 600, 360, 700);
  await sleep(900);
  await S.hoverOn('main', '#editKeys', { say: "Change shortcuts in Chrome", ring: true });
  await sleep(1100);

  S.chapter('Your data', 'Everything stays on this device. Export a backup, import it elsewhere, or clear it.');
  await scrollTo('#sNotes');
  S.cam(720, 330, 1.2, 800);
  await sleep(700);
  for (const id of ['#export', '#import', '#wipeShots']) {
    await S.hoverOn('main', id, { dur: 500 });
    await sleep(700);
  }
  await S.clickOn('main', '#wipe', { say: "Delete everything asks first" });
  await sleep(1800);
  const no = page.locator('#confirm .close').first();
  const nb = await no.boundingBox().catch(() => null);
  if (nb) await S.click('main', nb.x + nb.width / 2, nb.y + nb.height / 2, { say: "Cancel — nothing is deleted" });
  else await page.keyboard.press('Escape');
  await sleep(900);
  S.wide(800);
  await sleep(700);

  await S.finish();
  await env.ctx.close();
};

/* ───────────── How it works (overview) ───────────── */
VIDEOS['how-it-works'] = async () => {
  const data = [
    { url: SITES.shop.url, age: 50, notes: [{ x: 1080, y: 250, text: T.s1, color: C.G, done: true }] },
    { url: SITES.home.url, wait: 5000, age: 20, notes: [{ x: 760, y: 300, text: T.g1, urgent: true }, { x: 240, y: 470, text: T.g2, color: C.P }, { x: 1010, y: 520, text: T.g3, color: C.G, done: true }] },
  ];
  const { env, S, page } = await setup('how-it-works', { data, start: 'video' });
  const pp = await S.openPopup('streamly.tv');
  S.start();
  await S.attach('main', page, { width: 1440, height: 720 });
  await S.attach('popup', pp, { width: 380, height: 600 });
  showTab(S, 'video');
  let host = 'http://streamly.tv';
  S.watchBadge(() => host);
  S.logCursor('main', 700, 420);
  await page.mouse.move(700, 420);

  S.chapter('Pin a note anywhere', 'Watching a video? Open Page Notes, hit + New note, click the spot and write.');
  await sleep(900);
  await S.openPopupUI(pp);
  S.camPop(190, 300, 1.25, 800);
  await sleep(1100);
  await S.clickOn('popup', '#add', { say: "Click + New note" });
  await sleep(150);
  S.closePopupUI();
  S.wide(800);
  await sleep(500);
  await S.move('main', 560, 190, 1100);
  S.cam(660, 260, 1.5, 900);
  await S.click('main', 560, 190, { say: "Click the spot" });
  await sleep(500);
  await S.type('main', T.v1, 17, "Type your note");
  await sleep(700);
  await S.click('main', 1380, 650, { say: "Click outside to finish", dur: 800 });
  S.wide(900);
  await sleep(500);

  S.chapter('Drag one off the toolbar', 'Found something for later? Drag + Note and drop it right next to it.');
  const nb = await S.box('main', `${D} .split .new`);
  S.cam(1080, 460, 1.3, 900);
  await S.drag('main', nb.x + nb.width / 2, nb.y + nb.height / 2, 1050, 400, { say: "Drag + Note next to the video", dur: 1300 });
  await sleep(600);
  await S.type('main', T.v2, 17, "Type your note");
  await sleep(700);
  await S.click('main', 700, 650, { say: "Click outside to finish", dur: 700 });
  S.wide(900);
  await sleep(500);

  S.chapter('Highlight text', 'Select a sentence and press Alt+Shift+L (or pick Text): it is highlighted with a note next to it.');
  host = 'http://guetix.com/components';
  await go(S, page, 'docs');
  await sleep(600);
  const tb = await S.textBox('main', 'p', 'pin sticky notes anywhere, highlight text');
  S.cam(tb.x + tb.width / 2, tb.y + 60, 1.6, 900);
  await S.shortcut('guetix.com/components', ['Alt', 'Shift', 'L'], { type: 'place', mode: 'hl' }, "Press Alt+Shift+L (or choose Text)");
  await sleep(500);
  await S.move('main', tb.x - 10, tb.y + 10, 800);
  await S.selectText('main', 'p', 'pin sticky notes anywhere, highlight text', 1100, 'Select the sentence');
  await sleep(700);
  await S.type('main', T.doc, 17, "Type a note for the highlight");
  await sleep(700);
  await S.click('main', 1380, 650, { say: "Click outside to finish", dur: 800 });
  S.wide(900);
  await sleep(500);

  S.chapter('Stick a note to an element', 'Press Alt+Shift+E and click a card or button: the note follows it when the layout changes.');
  host = 'http://app.pulse.io';
  await go(S, page, 'dash');
  const ch = await S.box('main', '#k-churn');
  S.cam(ch.x + ch.width / 2, ch.y + 120, 1.5, 900);
  await S.shortcut('app.pulse.io', ['Alt', 'Shift', 'E'], { type: 'place', mode: 'el' }, "Press Alt+Shift+E (or choose Element)");
  await sleep(400);
  await S.move('main', ch.x + 60, ch.y + 50, 900);
  await sleep(400);
  await S.click('main', ch.x + 150, ch.y + 60, { say: "Click the card" });
  await sleep(500);
  await S.type('main', T.d2, 17, "Type your note");
  await sleep(700);
  await S.click('main', 700, 650, { say: "Click outside to finish", dur: 700 });
  S.wide(900);
  await sleep(500);

  S.chapter('They come back', 'Your review of guetix.com from yesterday: every note is right where you left it.');
  host = 'http://guetix.com';
  await go(S, page, 'home');
  await sleep(1300);
  const dk = await S.box('main', D);
  S.cam(dk.x + 60, dk.y - 100, 1.25, 900);
  for (let i = 0; i < 3; i++) {
    await S.clickOn('main', `${D} .nav button >> nth=1`, { say: "Click › to step through the notes", dur: i ? 260 : 800 });
    await sleep(1000);
  }
  S.wide(800);
  await sleep(500);

  S.chapter('The extension bar', 'Counts for this page, this site and everywhere, your sites, and quick filters.');
  await S.popupFor(pp, 'guetix.com');
  await S.openPopupUI(pp, { reload: false });
  S.camPop(190, 280, 1.5, 800);
  await sleep(900);
  await S.hoverOn('popup', '#sPage', { say: "Notes on this page", ring: true });
  await sleep(700);
  await S.hoverOn('popup', '#all', { say: "…and everywhere", ring: true });
  await sleep(700);
  await S.clickOn('popup', '#quick button[data-q="urgent"]', { say: "Filter: urgent" });
  await sleep(1300);
  await S.clickOn('popup', '#quick button[data-q="all"]', { say: "All again" });
  await sleep(700);
  await S.clickOn('popup', '#all', { say: "Click Everywhere to open All notes" });
  await sleep(150);
  S.closePopupUI();
  S.wide(700);

  S.chapter('All your notes', 'Every note from every site with a snapshot: search, filter, and jump straight back.');
  S.tab(NOTES_TAB);
  S.cutStart();
  await load(page, env.ext('notes.html'), 400);
  S.cutEnd();
  await sleep(1000);
  S.cam(560, 200, 1.4, 800);
  await S.clickOn('main', '#q', { say: "Search" });
  await S.type('main', 'hard mode', 10, "Type a few words");
  await sleep(1500);
  S.cam(360, 450, 1.4, 800);
  await S.clickOn('main', '#grid .card >> nth=0 >> .pg .ico', { say: "Click → to jump back to that note" });
  await sleep(200);
  S.wide(700);
  showTab(S, 'video');
  host = 'http://streamly.tv';
  S.cutStart();
  await load(page, S._opened || SITES.video.url, 700);
  S.cutEnd();
  await sleep(2600);

  S.chapter('Make it yours', 'Settings: when notes appear, the toolbar, tips, 10 languages, shortcuts and backups.');
  S.tab(SETTINGS_TAB);
  S.cutStart();
  await load(page, env.ext('notes.html#settings'), 700);
  S.cutEnd();
  await S.move('main', 720, 420, 600);
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 220);
    await sleep(500);
  }
  await sleep(900);

  await S.finish();
  await env.ctx.close();
};
