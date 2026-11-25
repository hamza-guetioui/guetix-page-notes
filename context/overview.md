# Overview — Guetix Page Notes

Sticky notes for any website. Everything stays in the browser (`chrome.storage.local`), no account, no server.

## On web pages (`content.js`, closed Shadow DOM)
- **Note types:** Note (pin anywhere), Element (sticks to a button/image/block; hold Shift), Text (highlight a selection, note beside it).
- **Placing:** "+ Note" (orange split button) → a ghost note follows the cursor; click places; Esc / right-click cancels. Optional placing guide card (full or compact "?").
- **Note card:** tape strip; header = colour dots · centre drag grip (only place that moves the note) · ! urgent · ✓ done · # copy link · – fold · ✕ delete.
  Re-clicking the selected colour opens the **opacity** card (30–100 %). Resize from the corner; size 160×110 … 460×480 and never larger than the window; long text scrolls.
- **Delete gesture:** drag a note to the top edge → iOS-style trash appears near the top centre; release on it deletes (Undo toast).
- **Toolbar ("dock"):** mascot + count, prev/next, + Note split button, fold, show/hide, options menu (copy as text, delete all here, settings…). Modes: When needed / Always small / Hidden. Draggable; position reset in Settings.
- **Inspect mode** (Dev setting): separate element notes stored under `d:` prefix.

## Popup / side panel (`popup.html/js`)
- Header: mascot, version, "How it works" (?), settings gear. Warm orange → blue gradient header.
- **Home:** stat cards (This page · this site · Everywhere/View all → opens All notes), this page's notes, orange **New note**, Tip card (only for new users: hidden after >10 notes on 2+ pages), show-notes switch, language.
- **Notes:** search, scope, sort, quick filters, note list. **Sites:** search combobox with suggestions + clear.
- Real shortcuts come from `chrome.commands.getAll` (no hard-coded keys).

## Dashboard (`notes.html/js`)
- **All notes:** search, site, sort, **view switcher** (Sticky glass [default] · Page preview · Timeline — Board code kept but its button is hidden; saved in `settings.notesView`), **Filter dropdown** (status radio All/Open/Done + AND tags Urgent/Highlights/With links, counts per option, saved in `settings.notesFilter`), Select + bulk actions. Board: drag between Open/Urgent/Done.
- **Guides (#guides):** 3 illustrated steps, animated "Good to know" tiles, real shortcut keycaps + Change shortcuts link, FAQ.
- **Settings (#settings):** sticky tab bar (wraps); sections: Notes on pages · **Customize** (1 Toolbar, 2 Personal: Appearance System/Light/Dark, Language, Snapshots) · Help & messages · Keyboard shortcuts · Your data (stats, orange Export backup, Import, clear snapshots, delete everything) · About · Dev (Inspect mode).
  Each option row has a hover **Preview** button that plays an animated demo of each choice (`previews.js`).

## Shortcuts (defaults, user can change at chrome://extensions/shortcuts)
place-note `Ctrl+Shift+Y` (Mac ⌘⇧Y) · place-element `Alt+Shift+E` · place-highlight `Alt+Shift+L` · toggle-notes `Alt+Shift+H`.
Chrome only applies new defaults on fresh installs.
