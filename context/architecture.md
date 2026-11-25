# Architecture

## Storage (`chrome.storage.local`)
| Key | Content |
|---|---|
| `p:<normalized url>` | page record `{ url, title, fav, notes:[…] }` (`d:` prefix while Inspect mode is on) |
| `s:<note id>` | snapshot JPEG data URL (kept apart so typing never rewrites images) |
| `settings` | object, see below — always read-modify-write, never overwrite other keys |
| `ui` | popup UI state (tourSeen, opens …) |

**Note shape** (sanitised by `PN.cleanNote` in `shared.js`): `id, text, color (PN.COLORS), op (0.3–1, opacity), x, y, anchor{sel,fx,dy}, hl{text,prefix,suffix}, off, quote, done, min, pri ("urgent"|""), w, h, createdAt, updatedAt`.

**Settings keys:** `visible, notesWhen, autoMin, dock, dockFolded, dockHidden, dockPos, tips, guide, guideMode, undo, snapshots, noteType, lang, theme (system|light|dark), sidePanel, dev, notesView, notesFilter{status,tags[]}`.

## Messages (content/popup → `background.js`)
`count` (badge) · `fonts` (UI fonts for the shadow root) · `keys` (real shortcuts via chrome.commands.getAll) · `open-dashboard` · `open-settings` · `send-to-tab` · `shot` (capture snapshot).
Background → content: commands (`place-*`, `toggle-notes` via `m.type`), `focus` (scroll to a note).

## Files
- `shared.js` — loaded in content script and extension pages; `PN` namespace (normUrl, allPages, COLORS, t(), setDev …).
  Page key = normUrl: no #hash, no tracking params, and per-site KEEP rules for pages that rewrite their own query
  (YouTube /watch keeps only ?v=). background.js runs PN.rekey on install/update/startup to move records saved under
  old keys. `npm test` (scripts/check-urls.mjs) checks both.
- `content.js` — one IIFE; shadow-root CSS is an array of strings at the top (tokens on `:host`, dark overrides `:host([data-theme=dark])`); `build(n)` builds a note, `draggable()`, `trackZone()/trashNote()` delete gesture, `opacityPop()`, dock builder, placing (`startPlacing`, ghost).
- `notes.js` — routing (`#settings`, `#guides`), card builders per view, filter model, board drag, settings tab bar.
- `popup.js` — tabs, stat cards, lists, Sites combobox, shortcut badges.
- `background.js` — side-panel mode (`applyPanelMode`), context menus, commands, badge, snapshots.
- `theme.js` — sets `data-theme` on `<html>` before CSS loads; listens to system changes.

## Invariants
- Extension pages: no remote code, no network. Content script never uses innerHTML with user/page text.
- Highlights use the CSS Custom Highlight API (`::highlight(gxpn-i)`).
