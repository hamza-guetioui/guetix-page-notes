# Testing

No unit tests. Verify every change with:
1. `node --check extension/*.js`.
2. Load unpacked in Chrome, ↻ Reload, try the feature on a real site **in light and dark**.
3. Screenshot harness (Playwright, used during the redesign): a script that opens `extension/*.html` with a stubbed `chrome.*` API and sample notes, and one that injects `shared.js` + `content.js` into a test page (closed shadow root switched to open only in the test). They lived in `%LOCALAPPDATA%/Temp/pn-shot/` (`shot3.mjs`, `dock.mjs`) — copy them into `tools/` if you want them versioned. Playwright is not a dependency of this repo; run with a global/borrowed install.
4. `npm run build` packs the zip.

Manual checklist: place each note type · drag via centre grip · delete via top trash + Undo · opacity · popup tabs · All notes 5 views + filter · settings previews · theme switch · export/import.
