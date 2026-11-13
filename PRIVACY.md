# Privacy — Guetix Page Notes

Last updated: 2026-11-10 · Full policy: https://guetix.com/components/page-notes-extension/privacy-policy

**Everything stays on your device.** Page Notes saves its data with `chrome.storage.local` in your browser profile.
There is no account, no server, no analytics and no ads, and the extension makes no network requests of its own.
Your data is never sold or shared.

What is saved (only on your device):

- The text of each note, its color, and whether it is done, urgent or folded.
- Where the note sits: the page address (without `#hash` or `utm_*` tracking parameters) and its position; for a note
  stuck to an element, a CSS selector and offset of that element.
- For a highlight: the selected text (up to 600 characters) plus up to 32 characters before and after it, so it can be
  found again; and up to 160 characters of the text a note was pinned on.
- A small snapshot (JPEG, about 20 KB) of the visible part of the page around a new note, shown in "All notes"
  (can be turned off in Settings).
- The page title and favicon address, creation / edit times, and your settings.

Permissions: `storage` / `unlimitedStorage` (save notes and snapshots locally) · `activeTab` + `scripting` (show notes
on the page you open, take the snapshot) · `contextMenus` (right-click "Pin a Page Note here").

You can export, import or delete everything in **Settings → Your data**. Removing the extension deletes its data.
