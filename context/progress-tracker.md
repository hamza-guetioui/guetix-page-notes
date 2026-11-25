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
