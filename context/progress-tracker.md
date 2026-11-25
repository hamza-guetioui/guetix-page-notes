# Progress tracker — Guetix Page Notes

## Status (2026-11-24)
- **Moved out of guetix.com.** This repo is now the only home of the extension source, store assets,
  tutorial media and video tooling. guetix.com keeps only what its website serves: the blog post + its images,
  the tutorial playlist/reel pages with `public/tutorial/page-notes/{recordings,music,posters,voice}`, and the
  downloadable zip `public/extensions/guetix-page-notes.zip` (refresh it from `dist/` after a release).
- Version **1.5.0** on `dev` (redesign merged via PRs #5/#6 era work); release = PR `dev` → `main`, then tag `v1.5.0`.
- Chrome Web Store listing is still on 1.2.0 (upload pending).
- 2026-11-25 All notes polish: Glass view removed, Board hidden (add "board" to `VIEWS` in notes.js + unhide its button to restore);
  toolbar row 2 = Filter + view switcher left, count + Select right, all 36px; fixed header/footer with a scrolling notes
  section (>700px wide, >520px tall); empty state centred + collapsible "How to add notes" panel (i18n keys `dTip*`).
- 2026-11-25 cards + dropdowns: Sticky cards fixed 196px, untilted (crisp text); Preview cards vertical — snapshot full
  width at its 16:6 ratio on top, fixed 128px body, `minmax(420px)` (2 per row on a laptop); Site/Sort are custom
  dropdowns (`dropdown()` in notes.js; the hidden `<select>` stays the source of truth) with favicons, counts, site search.
- 2026-11-25 Preview card v2: 3 per row (2 under 1000px, 1 under 640px); head = domain + "…" menu (`popMenu()`, actions from
  `noteActs()` shared with the hover bar); inset rounded snapshot (contain + blurred copy behind) opens the page; page path link in a box at its bottom over a
  dark gradient (redirect icon slides in on hover);
  4-line scrolling text; footer = status dropdown (Open / Urgent / Done, `STATUS`) + colour pill (dot + chevron) opening a "Note color" swatch popup (popMenu swatch mode) + time.
  Edit modal redesigned: header (colour bar · title · page · ×), body (colours + Urgent/Done, rounded note tinted
  from --c: pastel in light, dark tint + light text in dark), footer (hint · Cancel · Save).
  Colour popup opens upward (popMenu `up`). Snapshot follows the colour: on the page it is retaken when the pointer
  leaves a recoloured note (content.js `_shotColor`); a colour change in the dashboard drops the stale shot (`dropShot`)
  and content.js `fillShots()` takes a new one when the page is visible again (also fills old notes with no shot).
- Fix: YouTube notes vanished when the playlist moved ?index= (the page key changed). normUrl now keeps only ?v= on
  youtube.com/watch (KEEP table) + more tracking params (si, srsltid, igshid…); PN.rekey merges old records into
  the new key on install/update/startup. Self-check: `npm test`.
- Sticky card: header = favicon + domain · time; page link box under it (.pgb: link icon + the link: bold domain +
  muted path, page title in the tooltip; redirect icon always visible, stronger on hover), 13.5px text fills the free area and scrolls when long (also while editing; was clipped by .nc .t overflow:hidden),
  empty note placeholder fills it too (all clickable), inline edit puts the caret where you clicked and keeps the scroll
  (caretRangeFromPoint); no hover/focus lift and footer pills all 26px, so footers line up across a row,
  height 216px; actions are a drawer (actions(bot, e, true)): an always-visible "…" at the
  bottom right opens a row of actions above it, growing left (no done: the status dropdown does it; CSS tooltips above), morphs to ×; outside
  click / Esc closes, closed = inert; card is overflow:clip (focus can not scroll it); status = the preview dropdown
  (statusBtn, shared); new clearer action icons (AI). Edit modal header: site icon | domain over the page path;
  popMenu inside a card opens over the card (towards its larger side) and stays within its edges; pop menus are
  compact (min 150px, 30px rows); card badges (.npill/.vst) are white with a coloured ring (dark: --raised).
- Timeline redesign (rowCard): clock time in a gutter beside the rail, colour dot on the rail, rows with a 4px
  colour edge; text (click to edit, 3 lines) over favicon · domain / page link · time; status dropdown + action
  drawer (opens to the left) on the right. <=640px: no time gutter. Edit modal header slimmer (9px padding);
  the modal and keyboard-opened inline edit start the caret at the beginning of the text.
- Timeline row v2: a header line tinted with the note colour (site / page · time, status + drawer on the same
  line) over the note text, which scrolls past 5 lines (edit textarea same height, resizable). RTL checked (drawer,
  time gutter). Editor + delete-confirm labels now translated (cancel, save, edHint, edPh in all 10 languages).
- Note text never scrolls sideways (long words/URLs wrap) unless the note is set to "Don't wrap lines": new
  per-note toggle in the actions (n.nowrap, kept by cleanPage on import; vwWrap/vwNoWrap in 10 languages) -> lines
  keep their layout (code, tables) and scroll sideways. Dashboard only; the on-page note still wraps.
- Timeline row: plain card background, colour only in the border and the thin divider under the header
- content.js loading/lag fixes: (1) SPA navigation is picked up at once (Navigation API navigatesuccess +
  popstate; the 800ms timer is the fallback) - was up to 0.8s of the old page's notes; (2) load() ignores a
  storage reply for a page we already left (fast navigation could show no notes); (3) reposition is throttled,
  not debounced - on pages that never stop changing (feeds, players) it never ran, so highlight/element notes
  stayed hidden; (4) the MutationObserver does nothing on pages without notes. Tested on a stub SPA page.
- PN.withLoader (i18n.js) wraps the data loads of All my notes (refresh) and the popup (loadAll): after 300ms a
  small "Preparing your notes…" pill at the bottom centre (4 dots in the note colours, never blocks the page);
  on failure or after 10s it turns into "Couldn't load your notes" + Try again. Styles .pn-load in ui.css;
  strings ldNotes/ldErrT/ldErrX/retry in 10 languages.
  All my notes: the first load shows the state as a status page in the grid instead (loadState, same layout as
  the "no notes" page: colour dots + "Preparing your notes…", or ! + message + Try again); later reloads use the pill. so it reads as one element; note text has 14/18px padding and its hover/edit area fills the body. text is click-to-edit like preview (inlineEdit). Empty notes show a placeholder (textEl): low-opacity
  "Empty note — click to start writing" text where editable, "Empty note" elsewhere. i18n: emptyNote, emptyTap.
  Click / Enter on the note text edits it in place (`inlineEdit`: blur or Ctrl+Enter saves, Esc cancels).
  New i18n keys `vwMore`, `vwColor`, `clr0`..`clr3` (names of PN.COLORS in order).

## History carried over from guetix.com
**Page Notes extension** v1.3.1 (`extensions/page-notes/`), open source at
https://github.com/hamza-guetioui/guetix-page-notes (MIT). Chrome Web Store listing still on 1.2.0.
- Page Notes: protect the public repo's `main` (ruleset; `gh` CLI not installed here); upload v1.3.1 to the Chrome Web
- Page Notes working rule (owner, 2026-11-24): every change to `extensions/page-notes/` is mirrored right away (CRLF) into `../guetix-page-notes/extension/` on its local branch `feat/popup-redesign` (uncommitted until owner approves). Latest: Settings "More" → "Personal" (after Toolbar), Your data buttons restyled, settings tab bar wraps, shortcut text removed from "Show notes on pages" description. Then: All notes view switcher (Sticky glass default / Glass / Preview / Timeline / Board, saved as settings.notesView), status pills → one Filter dropdown (status radio + AND tags, settings.notesFilter), Settings Toolbar+Personal merged into "Customize" (2 numbered parts), note header drags only from the centre grip, re-click the picked colour opens opacity, note size capped to the window (max 460×480) with scrolling text, popup "View all" opens All notes.
- Page Notes popup redesign (uncommitted, on `dev` working tree; refs `public/design/image copy 4.png` / `image copy 5.png`): `extensions/page-notes/ui.css` new token set (Segoe/system sans, white layered surfaces, hairline borders, soft shadows, warm gradient + subtle grid, blue `--ac` primary, Fluent toggle); `popup.html`/`popup.js` rebuilt as header (mascot · version · ? tour · settings) + 3 tabs **Home** (stat cards, "This page's notes" box with (i) hover tooltip for page title/link, illustrated empty state, tip, show toggle + language) / **Notes** (search, All/This page/This site pills, sort, quick filters) / **Sites** (search, site rows → Notes filtered); popup is one surface (no inner frame). 21 new i18n keys × 10 locales in `i18n.js`. Same storage/actions. Merged upstream public-repo changes first (side panel mode, inspect mode / setDev, clipboardWrite, context-menu copy/delete all) so `extensions/page-notes/` = public `main` + redesign; later rounds: dashboard (All notes + Settings) and on-page toolbar restyled, orange New note, orange→blue header gradient (`--grad-head`), real `chrome.commands` shortcuts, Sites search combobox, ghost-note placing + drag-to-remove zone (content.js); top-edge-only animated trash, note opacity (dbl-click color, `op` field in `cleanPage`), tape drag handle, Guides view (`notes.html#guides`), Tip hidden for 10+ notes on 2+ pages, new-note shortcut `Ctrl+Shift+Y` (only applies on fresh installs; existing users keep their assignment) and real shortcut labels via a `keys` worker message; version bumped to 1.4.0 (manifest + public repo package.json, CHANGELOG `## 1.4.0`); redesign also applied (uncommitted) in `../guetix-page-notes` on local branch `feat/popup-redesign` + CHANGELOG Unreleased line. Open: `notes.html` dashboard still uses the old lab look on top of the new tokens (mixed); needs its own pass + OSS sync PR (`sync-page-notes-oss.mjs`) when approved.
- Page Notes Settings previews (uncommitted): new `extensions/page-notes/previews.js` (loaded by `notes.html` before `settings.js`) adds a ▶ Preview button to each setting row (visible, notesWhen, autoMin, dock, resetPos, tips, guide, guideMode, undo, snapshots, dev) that opens an inline mini mock page playing what the setting does (Web Animations, once then end state; reduced-motion = end state), with an On/Off or option compare toggle that never writes the real setting, Replay, Esc to close, one panel at a time; follows the real setting while open. `.pv-*` styles in `notes.html`. Read-only on storage; no setting behavior/IDs changed. Language/shortcuts/data/about have no preview. Open: OSS sync PR still pending.
- Page Notes dark mode for the extension pages (uncommitted): `theme.js` (loaded first in `<head>` of popup/notes/settings.html) sets `data-theme=dark` from `settings.theme` (`system` default | `light` | `dark`); dark tokens + overrides in `ui.css` and `[data-theme=dark]` blocks at the end of the inline styles in `popup.html`/`notes.html` (hard-coded light surfaces switched to tokens; light mode pixel-identical in screenshots). Settings → More gets an **Appearance** option group (System/Light/Dark mini illustrations, `data-key="theme"`, saved by the generic `settings.js` option path); 8 new i18n keys × 10 locales. On-page notes (content.js) not covered here. Open: `npx eslint extensions/page-notes` reports 1 error in `background.js` (`usePanel` flagged by react-hooks/rules-of-hooks, from separate uncommitted work); OSS sync PR pending.
- Page Notes JSDoc pass + OSS sync-via-PR script — PR #35 into `dev` (`32daa293`, `1f88c706`).
- Page Notes v1.3.1, narrated tutorial playlist, open source (MIT) — PR #30.

## 1.5.0 redesign — summary
Fluent-style popup (Home/Notes/Sites, stat cards, orange New note, tip only for new users) · dashboard redesign ·
Guides page · Settings: previews per option, sticky wrapping tabs, Customize (Toolbar + Personal), Appearance,
orange Export backup · dark mode everywhere · All notes view switcher (5 views) + Filter dropdown · on-page:
Fluent toolbar with orange + Note, ghost placing, iOS drag-to-delete, opacity on re-click, centre drag grip,
size limits with scrolling · default shortcut Ctrl+Shift+Y · `usePanel` → `applyPanelMode` (lint).

## Open questions / next steps
- Owner to test unpacked build in Chrome (light + dark, real sites), then approve commit + PR into `main`.
- `tools/videos/` scripts still use guetix.com paths (`public/tutorial/page-notes`, `extensions/page-notes`) — adapt to `media/tutorial` + `extension/` before reuse.
- "View all" focuses an existing All notes tab only if Chrome exposes tab URLs to the popup (may need `tabs` permission) — falls back to a new tab.
- Smaller toolbar ideas (auto-collapse, overflow menu) — not decided.
- Version-control the Playwright screenshot harness (now only in a temp folder).
