# AGENTS.md — Guetix Page Notes

> Index only, always loaded. Details live in `context/`.
> **This repo is now the single home of the Page Notes extension.** It no longer lives in the
> guetix.com repo (moved 2026-11-24). Do all extension work here.

## Product

**Guetix Page Notes** — a Chrome (MV3) extension by Hamza Guetioui: sticky notes on any website
(pin anywhere, highlight text, stick to an element), one "All notes" dashboard, Guides, Settings,
light/dark theme, 10 languages. Store: https://chromewebstore.google.com/detail/odjgbkgepfbfmjebffcohkkheonhhdcm ·
Landing: https://guetix.com/extensions/page-notes-extension · MIT.

## Stack

Plain JavaScript (ES5-style IIFEs), HTML, CSS. **No dependencies, no bundler** — `extension/` is loaded
unpacked as-is. `npm run build` (`scripts/build.mjs`, zero deps) draws icons and packs `dist/guetix-page-notes.zip`.

## Structure

```
extension/        the extension (load THIS folder in chrome://extensions → Load unpacked)
  manifest.json   MV3: popup + side panel, service worker, content script, 4 commands
  background.js   service worker: commands, context menus, badge, side-panel mode, snapshots, "keys" msg
  shared.js       PN namespace: storage keys, normUrl, COLORS, cleanNote, settings helpers (also in content script)
  content.js      on-page UI in a closed Shadow DOM: notes, toolbar ("dock"), placing, highlights, drag-to-delete
  popup.html/js   toolbar popup / side panel: Home · Notes · Sites tabs
  notes.html/js   dashboard: All notes (5 views + Filter dropdown) · Guides (#guides) · Settings (#settings)
  settings.js     Settings logic (settings.html only redirects to notes.html#settings)
  previews.js     animated "Preview" demos for each setting
  theme.js        applies light/dark before paint (settings.theme: system|light|dark)
  i18n.js         10 languages: en fr es de pt it ru ar zh ja
  ui.css          shared design tokens + components
store/            Chrome Web Store listing images + store-assets zip
media/            tutorial recordings / voice / music / posters, blog images (large exports git-ignored)
tools/videos/     video/recording tooling (moved from guetix.com — paths still need adapting, see its README)
docs/images/      README images · scripts/build.mjs   build + zip
context/          project docs (read before working)
```

## Rules (non-negotiable)

1. **Privacy is the product:** no network requests, no analytics; data only in `chrome.storage.local`.
2. **No dependencies / no build step** for `extension/`. Never use `innerHTML` with page or note text.
3. On-page UI stays inside the closed Shadow DOM in `content.js`; style it there.
4. New UI text → `i18n.js`, **all 10 languages**.
5. Every visual change must work in **light and dark** (`[data-theme=dark]`; content.js uses `:host([data-theme=dark])`).
6. Keep file overviews + JSDoc comments current. Keep each file's line endings (CRLF in this repo).
7. Do not change storage keys / note shape without a migration in `shared.js` (`cleanNote`).

## Commands

| Task | Command |
|---|---|
| Try it | chrome://extensions → Developer mode → Load unpacked → `extension/` → ↻ Reload after edits |
| Build zip | `npm run build` → `dist/guetix-page-notes.zip` |
| Syntax check | `node --check extension/<file>.js` |

## Git workflow

- `main` = released code (protected; PR only). Work on short branches (`feat/…`, `fix/…`).
- Current version **1.5.0** on `dev` (redesign); `main` still on 1.3.x until the release PR `dev` → `main`.
- **Never commit, push, open a PR, tag or publish without the owner's explicit approval.**
- Releases: bump `extension/manifest.json` + `package.json` + `CHANGELOG.md`, merge PR, tag `v*` on `main`
  (GitHub Actions builds the zip). The guetix.com site serves a copy of the zip at
  `public/extensions/guetix-page-notes.zip` — after a release copy `dist/guetix-page-notes.zip` there and bump
  `extension.version` in guetix.com `src/apps/pickui/registry-wave4.ts` (separate PR in that repo).

## Docs map

| File | Read when |
|---|---|
| `context/overview.md` | what the product does, every screen and feature |
| `context/architecture.md` | files, storage, messages, settings keys, data flow |
| `context/design-system.md` | tokens, colors, light/dark, component patterns |
| `context/testing.md` | how to verify changes (Playwright screenshot harness, manual checklist) |
| `context/progress-tracker.md` | what changed, open questions, next steps |
