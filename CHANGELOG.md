# Changelog

## 1.4.0
- Popup redesign: header with ? tour + settings, three tabs (Home / Notes / Sites), stat cards, this page's notes box
  with page info on hover, illustrated empty states, search + sort in Notes and Sites; refined look (system font,
  layered white surfaces, warm gradient header, blue primary actions). Same data and actions.
- All notes + Settings restyled to match; on-page toolbar restyled (orange "+ Note"); real shortcuts shown (none when unassigned).
- Placing: a ghost note follows the cursor - click to place, Esc / right click to cancel; drag a note to the top "Drop here to remove" zone to delete it (with Undo).
- Sites tab: search with suggestions and a clear button.
- Dark mode: Appearance setting (System / Light / Dark) for the popup, All notes, Guides, Settings and the on-page toolbar.
- Guides page (tips, shortcuts, FAQ) between All notes and Settings; Settings get sticky section tabs and a Preview (animated demo) per option.
- All notes cards: site badge + time on top, text first, status and tags below. Note opacity (double-click a color dot). New default shortcut Ctrl+Shift+Y.
- The popup tip shows only for new users (until 10+ notes on 2+ pages).
- Delete gesture is now iOS-like: the trash appears only when a note is pushed to the top edge; animated delete.
- Double-click a color dot to set a note's opacity; the tape on top of a note is a drag handle.
- New Guides page (All notes · Guides · Settings); the popup Tip hides once you have 10+ notes on 2+ pages.
- New-note shortcut is now Ctrl+Shift+Y (Cmd+Shift+Y on Mac); every shortcut label shows the real key, or nothing when unset.
- Docs: every source file now starts with a short overview, and functions have JSDoc comments (no code changes).

## 1.3.1
- Delete with Undo (no confirm for a single note) and a compact confirm dialog.
- No duplicate notes after the extension is reloaded or updated.

## 1.3.0
- New extension bar (popup): your sites, This page / This site / Recent, quick filters, Open/Done toggle, 10 languages,
  "Show this page's notes" per page.
- All notes: sticky list header (search, site, sort, tabs with counts), select + bulk actions, share / Markdown,
  sticky-note editor; Settings as a view of the same page.
- On-page toolbar: note count, ‹ › navigation, note type menu (Note / Element / Text), hide, options, draggable and
  snaps to a side, minimize / close; placing guide; N / E / T switch the type while placing.
- Notes stay inside the page, resizable, urgent flag; full-width snapshots.
- Fonts sent by the service worker (no web-accessible resources).

## 1.2.0
- Orange mark, dock, highlights, notes board.

## 1.1.0 / 1.0.0
- First releases: sticky notes on any page, saved locally.
