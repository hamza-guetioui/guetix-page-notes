# Contributing

Thanks for helping! Bug reports, translations and small focused pull requests are all welcome.

1. Fork, then load `extension/` unpacked in `chrome://extensions` (Developer mode).
2. Keep it dependency-free: plain JavaScript, no build step for the extension itself.
3. The on-page UI lives in a closed Shadow DOM (`content.js`) — keep styles inside it and never use `innerHTML`
   with page or note text.
4. Privacy is the product: no network requests, no analytics, data only in `chrome.storage.local`.
5. New UI text in the popup / settings goes through `i18n.js` (English first; other languages welcome).
6. Keep the comments up to date: each file starts with a short overview, and each function has a small JSDoc
   block (one sentence + `@param` / `@returns` when useful).
7. Run `npm run build` before opening the PR to be sure the zip packs.

Please describe what you changed and how you tested it (browser + site).
