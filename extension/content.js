/* Guetix Page Notes — content script (v1.1).
 *
 * Notes look and behave exactly like the @guetix/page-notes package (taped sticky notes you
 * pin anywhere and drag anywhere) plus what only an extension can do: they come back on every
 * visit, can stick to an element (hold Shift) or to highlighted text, get a snapshot for the
 * list, and have deep links. Everything renders in a closed Shadow DOM and lives in
 * chrome.storage.local — nothing leaves the browser.
 *
 * Main parts (in file order):
 *   - styles + mount: one <gx-page-notes> host with a closed shadow root (notes layer + fixed HUD)
 *   - storage: one record per page (key from PN.keyFor, see shared.js) plus global "settings"
 *   - anchoring: free (document px), element (CSS selector) or highlighted text (text + context)
 *   - notes: build, drag, resize, create, snapshot, delete (with Undo)
 *   - placing mode, dock (toolbar), toast, visibility, focus / deep links (#gx-note=<id>)
 *   - messages from background.js and observers that keep notes in place as the page changes
 *
 * Talking to background.js: send() wraps chrome.runtime.sendMessage (types: "fonts", "count",
 * "shot", "open-dashboard", "open-settings"); the worker sends "place", "place-at-context",
 * "toggle", "focus" and "reveal" (see the messages section). Other pages (popup, list) talk to
 * this script through chrome.storage changes (settings, page record, "focus"). */
(function () {
  if (window.__gxPageNotes) return;
  window.__gxPageNotes = true;

  var ORANGE = "#ff5b14";
  // Fluent UI tokens (copied from ui.css - a stylesheet cannot be linked into the closed shadow root)
  var UIF = "'Segoe UI Variable Text','Segoe UI',system-ui,-apple-system,Roboto,sans-serif";
  var BLUE = "#1b5ef7";
  var BLUE_HOVER = "#0f4ad8";
  var BLUE_GRAD = "linear-gradient(180deg,#2c6cff,#1554ec)";
  var ORANGE_GRAD = "linear-gradient(180deg,#ff8a3d 0%,#ff5b14 55%,#f04a0a 100%)"; // brand orange: the "+ Note" button
  var BLUE_TINT = "#eaf1ff";
  var BLUE_INK = "#0d3aa8";
  var HEAD_GRAD = "linear-gradient(100deg,#ffd2b3 0%,#ffe2cf 12%,#f3e6f0 22%,#e1eaff 32%,#d3e2ff 62%,#d9dcff 100%)";
  var SH_POP = "0 2px 4px rgba(17,24,39,.05),0 12px 32px rgba(17,24,39,.13)";

  // ---- styles: notes = the package's CSS (same sizes, tape, tilt, colors); chrome = Guetix lab style
  var STYLES = [
    ":host{all:initial}",
    // theme tokens for the chrome (dock, menus, cards, toasts); light = the original values, dark = :host([data-theme=dark]). Sticky notes keep their paper colors.
    ":host{--gx-surface:#fff;--gx-raised:#f1f3f7;--gx-hover:#f7f8fb;--gx-hover2:#eef0f5;--gx-border:#dde1ea;--gx-border2:#c9cfdb;--gx-sep:#eaecf2;--gx-ink:#171a22;--gx-muted:#5b6273;--gx-faint:#9aa1af;--gx-sw:#8a91a0;--gx-blue:" + BLUE + ";--gx-blue-h:" + BLUE_HOVER + ";--gx-tint:" + BLUE_TINT + ";--gx-tint-h:#e1ebff;--gx-blue-ink:" + BLUE_INK + ";--gx-vio-bg:#efeaff;--gx-vio:#6d3fe0;--gx-yel-bg:#fff6d6;--gx-yel:#a16207;--gx-danger:#c4314b;--gx-danger-bg:#fdecec;--gx-danger-h:#fdf3f4;--gx-danger-solid:#c4314b;--gx-danger-solid-h:#a4262c;--gx-toast:#1f2330;--gx-cnt:rgba(255,255,255,.82);--gx-scrim:rgba(17,24,39,.18);--gx-head:" + HEAD_GRAD + ";--gx-sh-pop:" + SH_POP + ";--gx-sh-dock:0 1px 2px rgba(17,24,39,.05),0 4px 16px rgba(17,24,39,.1);--gx-sh-toast:0 2px 4px rgba(17,24,39,.08),0 12px 32px rgba(17,24,39,.22)}",
    ":host([data-theme=dark]){color-scheme:dark;--gx-surface:#20232c;--gx-raised:#272b35;--gx-hover:#2e3340;--gx-hover2:#353a48;--gx-border:#323744;--gx-border2:#424858;--gx-sep:#2a2e39;--gx-ink:#eceef3;--gx-muted:#aab0bd;--gx-faint:#7a8191;--gx-sw:#7a8191;--gx-blue:#6e98ff;--gx-blue-h:#8aadff;--gx-tint:rgba(110,152,255,.16);--gx-tint-h:rgba(110,152,255,.24);--gx-blue-ink:#b4caff;--gx-vio-bg:rgba(162,131,255,.17);--gx-vio:#c4b0ff;--gx-yel-bg:rgba(242,201,76,.15);--gx-yel:#f6d77a;--gx-danger:#ff9b9b;--gx-danger-bg:rgba(244,124,124,.15);--gx-danger-h:rgba(244,124,124,.1);--gx-danger-solid:#d94a4a;--gx-danger-solid-h:#c23d3d;--gx-toast:#2b2f3a;--gx-cnt:rgba(14,16,22,.5);--gx-scrim:rgba(8,10,16,.42);--gx-head:linear-gradient(100deg,#583c37 0%,#4e3b3e 14%,#423d52 28%,#353f60 52%,#373a61 100%);--gx-sh-pop:0 1px 2px rgba(5,7,12,.35),0 10px 30px rgba(5,7,12,.38),inset 0 1px 0 rgba(255,255,255,.03);--gx-sh-dock:0 1px 2px rgba(5,7,12,.35),0 10px 30px rgba(5,7,12,.38),inset 0 1px 0 rgba(255,255,255,.04);--gx-sh-toast:0 1px 2px rgba(5,7,12,.35),0 10px 30px rgba(5,7,12,.4)}",
    "@media print{:host{display:none!important}}",
    "*{box-sizing:border-box}",
    // package notes ------------------------------------------------------------
    ".gxn-layer{position:absolute;left:0;top:0;width:0;height:0;font:14px/1.4 ui-rounded,system-ui,sans-serif}",
    ".gxn-note{position:absolute;width:190px;min-height:120px;padding:26px 10px 10px;border-radius:2px 2px 14px 2px;box-shadow:0 10px 24px -8px rgba(0,0,0,.55);transform:rotate(var(--r));color:#1c1917;pointer-events:auto;animation:gxn-in .35s cubic-bezier(.3,1.6,.5,1)}",
    '.gxn-tape{position:absolute;z-index:2;top:-8px;cursor:grab;touch-action:none;left:50%;width:56px;height:18px;transform:translateX(-50%) rotate(-3deg);background:rgba(255,255,255,.55);box-shadow:0 1px 2px rgba(0,0,0,.15)}',
    ".gxn-bar{position:absolute;top:4px;left:8px;right:6px;display:flex;align-items:center;gap:5px;user-select:none}",
    // the drag grip: only the free middle of the header moves the note (not the colours or the buttons)
    ".gxn-sp{flex:1;align-self:stretch;min-width:24px;min-height:18px;display:flex;align-items:center;justify-content:center;cursor:grab;touch-action:none;border-radius:6px;transition:background .15s}",
    ".gxn-sp::before{content:'';width:22px;height:8px;opacity:0;background:radial-gradient(circle,rgba(28,25,23,.45) 1.2px,transparent 1.6px) 0 0/5.5px 4px;transition:opacity .15s}",
    ".gxn-note:hover .gxn-sp::before{opacity:.8}.gxn-sp:hover{background:rgba(28,25,23,.06)}",
    ".gxn-sp:active,.gxn-num:active,.gxn-tape:active{cursor:grabbing}",
    '.gxn-note.pg::before,.gxn-note.ghost::before{content:"";position:absolute;top:-8px;left:50%;width:56px;height:18px;transform:translateX(-50%) rotate(-3deg);background:rgba(255,255,255,.55);box-shadow:0 1px 2px rgba(0,0,0,.15)}', // previews keep the tape look
    ".gxn-dot{all:unset;width:12px;height:12px;border-radius:50%;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,.2)}",
    ".gxn-dot[aria-pressed=true]{box-shadow:inset 0 0 0 1px rgba(0,0,0,.2),0 0 0 1.5px #1c1917}",
    // opacity popover (double-click a color dot)
    ".gxn-op{position:absolute;top:30px;left:8px;right:8px;z-index:5;display:flex;flex-direction:column;gap:9px;padding:10px 12px 12px;border:1px solid var(--gx-border);border-radius:12px;background:var(--gx-surface);box-shadow:var(--gx-sh-pop);font:600 11.5px/1 " + UIF + ";color:var(--gx-ink);animation:gx-down .16s cubic-bezier(.2,.9,.3,1.2)}",
    ".gxn-op .oh{display:flex;align-items:center;gap:8px}",
    ".gxn-op b{flex:1;font-weight:600;color:var(--gx-muted)}",
    ".gxn-op output{min-width:38px;padding:3px 7px;border-radius:999px;background:var(--gx-raised,rgba(127,127,127,.12));text-align:center;font-variant-numeric:tabular-nums}",
    // swatch: the note colour at the chosen opacity, over a checkerboard
    ".gxn-op .osw{width:18px;height:18px;border-radius:5px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.12);background:linear-gradient(var(--oc-now),var(--oc-now)),repeating-conic-gradient(#d9dce3 0 25%,#fff 0 50%) 0 0/8px 8px}",
    // track: from 30% to 100% of the note colour, over a checkerboard; thumb filled with the current colour
    ".gxn-op input{-webkit-appearance:none;appearance:none;width:100%;height:14px;margin:0;border-radius:999px;cursor:pointer;background:linear-gradient(90deg,var(--oc-lo),var(--oc)),repeating-conic-gradient(#d9dce3 0 25%,#fff 0 50%) 0 0/8px 8px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.1)}",
    ".gxn-op input::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:linear-gradient(var(--oc-now),var(--oc-now)),#fff;border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.14),0 2px 6px rgba(0,0,0,.22);transition:transform .15s cubic-bezier(.2,.9,.3,1.4)}",
    ".gxn-op input:active::-webkit-slider-thumb{transform:scale(1.15)}",
    ".gxn-op input:focus-visible{outline:2px solid var(--gx-blue);outline-offset:3px}",
    ".gxn-dot:focus-visible,.gxn-x:focus-visible,.gxn-num:focus-visible,.gxn-link:focus-visible{outline:2px solid " + BLUE + ";outline-offset:1px;border-radius:4px}",
    ".gxn-x{all:unset;cursor:pointer;opacity:.55;font:500 13px/1 " + UIF + ";padding:2px 3px;border-radius:4px;transition:opacity .15s,background .15s}",
    ".gxn-x:hover{opacity:1;background:rgba(28,25,23,.08)}",
    ".gxn-x[aria-pressed=true]{opacity:1}",
    ".gxn-text,.gxn-view{all:unset;display:block;width:100%;min-height:80px;white-space:pre-wrap;word-break:break-word;font:500 12.5px/1.6 'GXPN Mono',ui-monospace,monospace;letter-spacing:-.01em;color:#1c1917;cursor:text}",
    ".gxn-text{caret-color:#c2410c}",
    ".gxn-text::selection,.gxn-view::selection{background:rgba(28,25,23,.18)}",
    ".gxn-view{display:none}",
    ".gxn-note.viewing .gxn-text{display:none}.gxn-note.viewing .gxn-view{display:block}",
    ".gxn-view a{display:inline-flex;align-items:center;gap:3px;max-width:100%;padding:0 7px 0 5px;margin:1px;border-radius:999px;background:rgba(28,25,23,.88);color:#fff;font:600 11px/19px " + UIF + ";text-decoration:none;vertical-align:1px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;transition:background .15s}",
    ".gxn-view a::before{content:'\u2197';color:#9dbcff;font-weight:700}",
    ".gxn-view a:hover{background:" + BLUE + "}.gxn-view a:hover::before{color:#fff}",
    ".gxn-rs{position:absolute;right:1px;bottom:1px;width:16px;height:16px;cursor:nwse-resize;opacity:0;touch-action:none;transition:opacity .15s;background:linear-gradient(135deg,transparent 0 55%,rgba(28,25,23,.5) 55% 62%,transparent 62% 72%,rgba(28,25,23,.5) 72% 79%,transparent 79%)}",
    ".gxn-note:hover .gxn-rs,.gxn-note.resizing .gxn-rs{opacity:1}",
    ".gxn-note.sized{display:flex;flex-direction:column}",
    // size limits: min 160x110, max 460x480 and never larger than the visible window; longer text scrolls inside
    ".gxn-note{min-width:160px;max-width:min(460px,calc(100vw - 24px));max-height:min(480px,calc(100vh - 24px));box-sizing:border-box}",
    ".gxn-note:not(.min){display:flex;flex-direction:column}",
    ".gxn-note:not(.min) .gxn-text,.gxn-note:not(.min) .gxn-view{flex:1 1 auto;min-height:60px;max-height:calc(min(480px,100vh - 24px) - 64px);overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:rgba(28,25,23,.3) transparent}",
    ".gxn-note.sized .gxn-text,.gxn-note.sized .gxn-view{flex:1;min-height:0;overflow:auto;scrollbar-width:thin}",
    ".gxn-note.resizing,.gxn-note.dragging{animation:none;transition:none}",
    ".gxn-note.dragging,.gxn-note.ghost{transition:opacity .16s,transform .18s cubic-bezier(.2,.9,.3,1.2)}.gxn-note.pg{transition:opacity .16s}", // armed (doomed) feedback (the ghost moves by transform: no transform transition)
    ".gxn-text:empty::before{content:attr(data-ph);opacity:.45}",
    "@keyframes gxn-in{from{opacity:0;transform:rotate(var(--r)) scale(.6) translateY(-10px)}}",
    // extension extras on the note --------------------------------------------
    ".gxn-meta{display:flex;flex-wrap:wrap;gap:4px 6px;align-items:center;margin-top:6px;font:500 10.5px/1.3 " + UIF + ";letter-spacing:0;color:rgba(28,25,23,.6)}",
    ".gxn-q{max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}",
    ".gxn-lost{color:#b91c1c;font-weight:700}",
    ".gxn-link{all:unset;cursor:pointer;padding:1px 7px;border:1px solid rgba(28,25,23,.22);border-radius:999px;background:rgba(255,255,255,.45);color:#1c1917;max-width:150px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;transition:background .15s,color .15s,border-color .15s}",
    ".gxn-link:hover{background:" + BLUE + ";border-color:" + BLUE + ";color:#fff}",
    ".gxn-note[data-done] .gxn-text{text-decoration:line-through;opacity:.55}",
    ".gxn-stamp{display:none;position:absolute;right:8px;bottom:8px;padding:2px 7px;border-radius:4px;background:#1c1917;color:#fff;font:700 9.5px " + UIF + ";letter-spacing:.12em;transform:rotate(-8deg)}",
    ".gxn-note[data-done] .gxn-stamp{display:block;background:#15803d}",
    ".gxn-num{all:unset;display:none;cursor:grab;font:700 13px " + UIF + ";font-variant-numeric:tabular-nums;color:#1c1917;padding:2px 2px 0;touch-action:none}",
    ".gxn-flag{font-weight:900;font-family:system-ui,sans-serif}",
    ".gxn-flag[aria-pressed=true]{color:#dc2626;opacity:1}",
    ".gxn-note.urgent{box-shadow:0 0 0 2px #dc2626,0 10px 24px -8px rgba(0,0,0,.55)}",
    ".gxn-note.urgent .gxn-tape{background:rgba(220,38,38,.85)}",
    ".gxn-urg{padding:1px 6px;border-radius:999px;background:#dc2626;color:#fff;font-weight:700;letter-spacing:.08em}",
    ".gxn-note.min{width:auto!important;height:auto!important;min-height:0;padding:9px 9px 7px;border-radius:2px 2px 9px 2px}",
    ".gxn-note.min .gxn-tape{width:30px;height:12px;top:-6px}",
    ".gxn-note.min .gxn-bar,.gxn-note.min .gxn-text,.gxn-note.min .gxn-view,.gxn-note.min .gxn-meta,.gxn-note.min .gxn-stamp,.gxn-note.min .gxn-rs{display:none!important}",
    ".gxn-note.min .gxn-num{display:block}",
    ".gxn-note.pulse{animation:gxn-pulse 1.1s ease-out 2}",
    "@keyframes gxn-pulse{0%{box-shadow:0 0 0 0 rgba(27,94,247,.7),0 10px 24px -8px rgba(0,0,0,.55)}100%{box-shadow:0 0 0 22px rgba(27,94,247,0),0 10px 24px -8px rgba(0,0,0,.55)}}",
    ".gxn-note.ghost{font:14px/1.4 ui-rounded,system-ui,sans-serif;text-transform:none;letter-spacing:0;position:fixed;pointer-events:none;opacity:.92;animation:none;box-shadow:0 22px 40px -10px rgba(0,0,0,.5)}",
    // chrome (dock, hint, guides, toast): Fluent look, same values as ui.css (popup) ----------
    ".lab{font:400 12px/1.25 " + UIF + ";letter-spacing:0;color:var(--gx-ink);text-transform:none}",
    ".fixed{position:fixed;inset:0;pointer-events:none}",
    ".catch{position:fixed;inset:0;display:none;pointer-events:auto;cursor:crosshair}",
    ".gh,.gv{position:fixed;display:none;pointer-events:none;background:var(--gx-blue)}",
    ".gh{left:0;right:0;height:1px}.gv{top:0;bottom:0;width:1px}",
    ".snap .gh,.snap .gv{background:repeating-linear-gradient(90deg,var(--gx-blue) 0 6px,transparent 6px 10px)}",
    ".snap .gv{background:repeating-linear-gradient(180deg,var(--gx-blue) 0 6px,transparent 6px 10px)}",
    ".coord{position:fixed;display:none;align-items:center;gap:7px;pointer-events:none;padding:3px 9px 3px 3px;border-radius:8px;background:var(--gx-toast);color:#fff;white-space:nowrap;font:500 12px/1.2 " + UIF + ";box-shadow:var(--gx-sh-pop)}",
    ".ai{display:grid;place-items:center;width:22px;height:22px;border-radius:6px;background:" + BLUE_GRAD + ";color:#fff}",
    ".ai.t-el{background:#6d3fe0;color:#fff}.ai.t-hl{background:#fde047;color:#713f12}",
    ".ai svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}",
    ".tx{position:fixed;display:none;pointer-events:none;border:1.5px dashed #eab308;border-radius:6px;background:rgba(253,224,71,.16);transition:left .08s,top .08s,width .08s,height .08s}",
    ".tx i{position:absolute;left:-1.5px;bottom:100%;margin-bottom:4px;padding:3px 8px;border-radius:6px;background:#713f12;color:#fef9c3;font-style:normal;white-space:nowrap;text-transform:none;letter-spacing:0;font:600 11.5px " + UIF + "}",
    ".coord b{color:#9dbcff;font-weight:600}",
    ".hl{position:fixed;display:none;pointer-events:none;border:1.5px solid var(--gx-blue);border-radius:6px;background:rgba(27,94,247,.07)}",
    ".hl::before,.hl::after{content:'';position:absolute;width:9px;height:9px;border:2px solid var(--gx-blue)}",
    ".hl::before{left:-5px;top:-5px;border-right:0;border-bottom:0}.hl::after{right:-5px;bottom:-5px;border-left:0;border-top:0}",
    ".hl i{position:absolute;left:-1.5px;bottom:100%;margin-bottom:4px;padding:3px 8px;border-radius:6px;background:#0d3aa8;color:#fff;font:500 11.5px " + UIF + ";font-style:normal;white-space:nowrap;max-width:320px;overflow:hidden;text-overflow:ellipsis}",
    // guide card (teaching tip): icon tile + title + key steps + close
    ".hint{position:fixed;right:16px;bottom:66px;display:none;align-items:center;gap:12px;width:max-content;max-width:min(390px,calc(100vw - 32px));padding:10px 8px 10px 10px;background:var(--gx-surface);color:var(--gx-ink);border:1px solid var(--gx-border);border-radius:12px;box-shadow:var(--gx-sh-pop);pointer-events:auto;text-transform:none;letter-spacing:0;font:400 13px/1.35 " + UIF + ";animation:gx-up .18s ease-out}",
    ".hint::after{content:'';position:absolute;right:46px;bottom:-5px;width:10px;height:10px;background:var(--gx-surface);transform:rotate(45deg)}",
    ".hi-ic{display:grid;place-items:center;flex:none;width:36px;height:36px;border-radius:10px;background:var(--gx-head);color:var(--gx-blue);box-shadow:inset 0 0 0 1px rgba(27,94,247,.12)}",
    ".hi-ic svg,.t-ic svg,.dk svg,.mi svg{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}",
    ".hi-ic svg{width:18px;height:18px}",
    ".hi-tx{display:grid;gap:5px;min-width:0}",
    ".hi-tx b{font-weight:600;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".hi-tx small{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;font-size:12px;color:var(--gx-muted)}",
    ".hint kbd{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 6px;margin-right:5px;border-radius:6px;background:var(--gx-hover);border:1px solid var(--gx-border);box-shadow:inset 0 -1px 0 var(--gx-border);color:var(--gx-ink);font:600 11px/1 " + UIF + "}",
    ".hi-x{all:unset;flex:none;align-self:flex-start;cursor:pointer;display:grid;place-items:center;width:26px;height:26px;border-radius:8px;color:var(--gx-muted);transition:background .15s,color .15s}",
    ".hi-x svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}",
    ".hi-x:hover{background:var(--gx-hover);color:var(--gx-ink)}",
    ".hi-x:focus-visible{outline:2px solid var(--gx-blue);outline-offset:1px}",
    // toast: icon + message + optional action, with a countdown bar
    ".toast{position:fixed;right:16px;bottom:66px;display:none;align-items:center;gap:10px;max-width:min(390px,calc(100vw - 32px));padding:6px 6px 6px 8px;border-radius:10px;overflow:hidden;background:var(--gx-toast);color:#fff;pointer-events:auto;text-transform:none;letter-spacing:0;font:400 13px/1.3 " + UIF + ";box-shadow:var(--gx-sh-toast);animation:gx-up .18s ease-out}",
    ".t-ic{display:grid;place-items:center;flex:none;width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,.1);color:#9dbcff}",
    ".t-ic svg{width:15px;height:15px}",
    ".t-tx{padding-right:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".toast button{all:unset;flex:none;cursor:pointer;height:28px;padding:0 12px;border-radius:8px;background:" + BLUE_GRAD + ";color:#fff;font:600 12.5px/28px " + UIF + "}",
    ".toast button:hover{background:" + BLUE_HOVER + "}",
    ".toast button:focus-visible{outline:2px solid #9dbcff;outline-offset:1px}",
    ".t-bar{position:absolute;left:0;bottom:0;width:100%;height:2px;background:#4c86ff;transform-origin:left;animation:gx-count linear forwards}",
    "@keyframes gx-count{from{transform:scaleX(1)}to{transform:scaleX(0)}}",
    "@keyframes gx-drop{from{opacity:0;transform:translate(-50%,-8px)}}",
    "@keyframes gx-rise{from{opacity:0;transform:translate(-50%,8px)}}",
    // dock (bottom right): [logo + count] [nav] [+ Note | caret] [min] [eye] [more] [x]  -  folded = logo + count only
    ".dock{position:fixed;right:16px;bottom:16px;display:none;align-items:center;gap:2px;padding:4px;background:var(--gx-surface);border:1px solid var(--gx-border);border-radius:12px;box-shadow:var(--gx-sh-dock);font:400 13px/1.2 " + UIF + ";pointer-events:auto;animation:dock-in .3s cubic-bezier(.3,1.4,.5,1)}",
    ".dock button{all:unset;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;height:32px;border-radius:8px;transition:background .15s,color .15s,box-shadow .15s}",
    ".vr{flex:none;width:1px;height:18px;margin:0 3px;background:var(--gx-sep)}",
    ".dock.placing>.vr{display:none}",
    ".dock button:focus-visible{outline:2px solid var(--gx-blue);outline-offset:1px}",
    ".dk{width:32px;color:var(--gx-muted)}.dk:hover{background:var(--gx-hover);color:var(--gx-ink)}",
    ".dk svg{width:16px;height:16px;stroke-width:1.7}",
    ".dock .brand{position:relative;padding:0 6px 0 7px;background:var(--gx-head);box-shadow:inset 0 0 0 1px rgba(17,24,39,.05)}",
    ".dock .brand:hover{box-shadow:inset 0 0 0 1px rgba(27,94,247,.25)}",
    ".dock.collapsed{padding:3px}",
    ".cnt{min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:var(--gx-cnt);color:var(--gx-ink);box-shadow:inset 0 0 0 1px rgba(17,24,39,.08);font:600 11.5px/20px " + UIF + ";font-variant-numeric:tabular-nums;text-align:center;box-sizing:border-box}",
    ".cnt.zero{display:none}",
    ".split{display:flex;align-items:stretch;margin:0 2px;border-radius:999px;background:" + ORANGE_GRAD + ";box-shadow:0 1px 2px rgba(200,60,5,.3),inset 0 1px 0 rgba(255,255,255,.25),inset 0 0 0 1px rgba(200,60,5,.3)}",
    ".split button{color:#fff;font:600 13px " + UIF + ";letter-spacing:0;text-transform:none}",
    ".split .new{padding:0 10px 0 12px;touch-action:none;border-radius:999px 0 0 999px}",
    ".split .new kbd{margin-left:2px;padding:0 5px;height:18px;display:inline-grid;place-items:center;border-radius:6px;background:rgba(255,255,255,.2);font:600 10.5px/1 " + UIF + ";letter-spacing:0;text-transform:none;color:#fff}",
    ".split .new svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}",
    ".menu button[aria-checked=true]{background:var(--gx-tint)}",
    ".menu button[aria-checked=true]:hover{background:var(--gx-tint-h)}",
    ".menu button[aria-checked=true] .mt b{color:var(--gx-blue-ink)}",
    ".menu button[aria-checked=true]::before{content:'';position:absolute;left:0;top:9px;bottom:9px;width:3px;border-radius:3px;background:var(--gx-blue)}",
    ".menu button[aria-checked=true]::after{content:none}",
    ".split .caret{width:28px;border-left:1px solid rgba(255,255,255,.28);border-radius:0 999px 999px 0}",
    ".split .new:hover,.split .caret:hover{background:rgba(255,255,255,.12)}",
    ".split:hover{background:" + ORANGE_GRAD + ";filter:brightness(1.05);box-shadow:0 4px 14px rgba(255,91,20,.35)}",
    ".split .caret svg{width:10px;height:10px;fill:none;stroke:currentColor;stroke-width:2;transition:transform .2s}",
    ".split .caret[aria-expanded=true] svg{transform:rotate(180deg)}",
    ".menu{position:absolute;right:0;bottom:calc(100% + 8px);min-width:264px;display:none;flex-direction:column;padding:6px;border-radius:10px;background:var(--gx-surface);border:1px solid var(--gx-border);box-shadow:var(--gx-sh-pop);font:400 13px/1.3 " + UIF + ";color:var(--gx-ink);letter-spacing:0;text-transform:none;animation:gx-up .14s ease-out}",
    ".notips .st-l,.notips .status .help,.notips .cxy,.notips .tx i,.notips .hl i{display:none!important}",
    ".notips .coord{padding:3px}",
    ".cfm-bg{position:fixed;inset:0;display:none;place-items:center;background:var(--gx-scrim);pointer-events:auto;text-transform:none;letter-spacing:0}",
    ".cfm-bg.on{display:grid}",
    ".cfm{display:grid;grid-template-columns:auto 1fr;column-gap:12px;row-gap:3px;align-items:center;width:min(300px,calc(100vw - 32px));padding:16px;border:1px solid var(--gx-border);border-radius:12px;background:var(--gx-surface);box-shadow:var(--gx-sh-pop);font:400 13px/1.4 " + UIF + ";color:var(--gx-ink);animation:gx-up .14s ease-out}",
    ".cfm .ci2{grid-row:1/3;display:grid;place-items:center;width:34px;height:34px;border-radius:8px;background:var(--gx-danger-bg);color:var(--gx-danger)}",
    ".cfm .ci2 svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}",
    ".cfm b{font:600 14px/1.25 " + UIF + "}",
    ".cfm p{margin:0;color:var(--gx-muted);font-size:12.5px}",
    ".cfm .row2{grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px;margin-top:14px}",
    ".cfm button{all:unset;box-sizing:border-box;height:32px;padding:0 14px;border-radius:8px;font:600 13px/32px " + UIF + ";cursor:pointer;text-align:center;transition:background .15s,border-color .15s}",
    ".cfm .no{border:1px solid var(--gx-border);background:var(--gx-surface);color:var(--gx-ink);line-height:30px}.cfm .no:hover{background:var(--gx-hover);border-color:var(--gx-border2)}",
    ".cfm .yes{background:var(--gx-danger-solid);color:#fff}.cfm .yes:hover{background:var(--gx-danger-solid-h)}",
    ".cfm button:focus-visible{outline:2px solid var(--gx-blue);outline-offset:1px}",
    ".mh{padding:8px 8px 4px;font:600 12px " + UIF + ";letter-spacing:0;text-transform:none;color:var(--gx-muted)}",
    ".menu.open{display:flex}",
    "@keyframes gx-up{from{opacity:0;transform:translateY(6px)}}",
    ".menu button{position:relative;justify-content:flex-start;gap:10px;height:34px;padding:0 8px;border-radius:8px;text-align:left;font:inherit;color:var(--gx-ink)}",
    ".menu button:hover,.menu button:focus-visible{background:var(--gx-hover)}",
    ".menu button:focus-visible{outline:2px solid var(--gx-blue);outline-offset:-2px}",
    ".mi{display:grid;place-items:center;flex:none;width:20px;height:20px;border-radius:6px;background:var(--gx-raised);color:var(--gx-muted)}",
    ".mi svg{width:14px;height:14px}",
    ".mi.o{background:var(--gx-tint);color:var(--gx-blue)}.mi.b{background:var(--gx-vio-bg);color:var(--gx-vio)}.mi.y{background:var(--gx-yel-bg);color:var(--gx-yel)}",
    ".mt{display:flex;align-items:center;gap:6px;min-width:0;flex:1}",
    ".mt b{font-weight:inherit;white-space:nowrap}",
    ".mt small{display:none}",
    ".menu.desc button{height:auto;min-height:36px;padding:7px 8px}",
    ".menu .mt b{font-weight:600;color:var(--gx-ink)}",
    ".menu.desc .mt{flex-direction:column;align-items:flex-start;gap:2px}",
    ".menu.desc .mt small{display:block;font:400 12px/1.3 " + UIF + ";color:var(--gx-muted);white-space:nowrap}",
    ".menu.desc .mi{width:30px;height:30px;border-radius:8px}",
    ".menu kbd{margin-left:auto;padding:0 6px;height:20px;display:inline-grid;place-items:center;border-radius:6px;border:1px solid var(--gx-border);background:var(--gx-hover);font:500 11px/1 " + UIF + ";color:var(--gx-muted)}",
    ".mi.r{background:var(--gx-danger-bg);color:var(--gx-danger)}.menu .danger .mt b{color:var(--gx-danger)}.menu .danger:hover{background:var(--gx-danger-h)}",
    ".mk{display:flex;gap:6px;padding:2px 8px 6px 38px;font:500 11px " + UIF + ";color:var(--gx-faint)}",
    ".mk span{display:inline-flex;align-items:center;gap:4px}",
    ".menu .mk kbd{margin:0 3px 0 0;height:18px;padding:0 5px;font-size:10.5px}",
    ".menu hr{border:0;height:1px;margin:4px 2px;background:var(--gx-sep)}",
    ".nav{display:flex;align-items:center;gap:1px}",
    ".nav button{width:28px;color:var(--gx-muted)}.nav button:hover{background:var(--gx-hover);color:var(--gx-ink)}",
    ".nav button[disabled]{opacity:.4;cursor:default;background:none}",
    ".nav svg{width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}",
    ".pos{min-width:46px;height:22px;padding:0 7px;border-radius:999px;background:var(--gx-raised);text-align:center;font:600 11.5px/22px " + UIF + ";font-variant-numeric:tabular-nums;color:var(--gx-faint);letter-spacing:0;box-sizing:border-box}",
    ".pos b{color:var(--gx-ink);font-weight:600}",
    ".status{display:none;align-items:center;gap:8px;padding:0 0 0 8px;font:600 13px " + UIF + ";letter-spacing:0;text-transform:none;white-space:nowrap;color:var(--gx-ink)}",
    ".status .sdot{width:8px;height:8px;border-radius:50%;background:var(--gx-blue);box-shadow:0 0 0 3px rgba(27,94,247,.2);animation:gx-pulse 1.4s ease-in-out infinite}",
    "@keyframes gx-pulse{50%{box-shadow:0 0 0 6px rgba(27,94,247,0)}}",
    ".status .help{width:28px;height:28px;border-radius:50%;background:var(--gx-hover);box-shadow:inset 0 0 0 1px var(--gx-border);color:var(--gx-muted);font:600 13px " + UIF + "}",
    ".status .help:hover{background:var(--gx-hover2);color:var(--gx-ink)}",
    ".status .help[aria-pressed=true]{background:var(--gx-tint);box-shadow:inset 0 0 0 1px rgba(27,94,247,.3);color:var(--gx-blue)}",
    ".status .cancel{padding:0 14px;height:32px;background:var(--gx-surface);box-shadow:inset 0 0 0 1px var(--gx-border);color:var(--gx-ink);font:600 13px " + UIF + ";letter-spacing:0;text-transform:none}",
    ".status .cancel:hover{background:var(--gx-hover);box-shadow:inset 0 0 0 1px var(--gx-border2)}",
    ".dock.placing .status{display:flex}",
    ".dock.placing>.nav,.dock.placing>.split,.dock.placing>.dk{display:none}",
    ".mf{display:flex;flex-direction:column;padding:0}",
    ".mf label{display:flex;align-items:center;justify-content:space-between;gap:14px;height:28px;padding:0 8px;border-radius:8px;font:inherit;font-weight:600;color:var(--gx-ink);cursor:pointer}",
    ".mf label:hover{background:var(--gx-hover)}",
    ".mf small{display:block;margin-top:2px;font:400 12px/1.3 " + UIF + ";color:var(--gx-muted)}",
    ".mf label{height:auto!important;padding:7px 8px!important}",
    // Fluent toggle (same as .switch in ui.css)
    ".sw{all:unset;box-sizing:border-box;position:relative;flex:none;width:36px;height:20px;border-radius:999px;border:1px solid var(--gx-sw);background:var(--gx-surface);transition:background .15s,border-color .15s;cursor:pointer}",
    ".sw::after{content:'';position:absolute;left:3px;top:3px;width:12px;height:12px;border-radius:50%;background:var(--gx-muted);transition:transform .18s cubic-bezier(.3,.7,.4,1),background .15s}",
    ".sw:hover{border-color:var(--gx-ink)}",
    ".sw:checked{background:var(--gx-blue);border-color:var(--gx-blue)}.sw:checked::after{transform:translateX(16px);background:#fff}",
    ".sw:checked:hover{background:var(--gx-blue-h);border-color:var(--gx-blue-h)}",
    ".sw:focus-visible{outline:2px solid var(--gx-blue);outline-offset:2px}",
    // logo: the orange two-eyed mark, now a sticky note (tape on top, folded corner)
    ".mark{position:relative;display:inline-block;flex:none;font-size:20px;width:1em;height:1em;border-radius:.2em;background:linear-gradient(rgba(255,255,255,.6),rgba(255,255,255,.6)) no-repeat 50% 0/.44em .13em," + ORANGE + ";clip-path:polygon(0 0,100% 0,100% 70%,70% 100%,0 100%)}",
    ".mark::before{content:'';position:absolute;left:.21em;top:.34em;width:.19em;height:.19em;border-radius:.04em;background:#141414;box-shadow:.39em 0 0 #141414}",
    ".mark::after{content:'';position:absolute;right:0;bottom:0;width:.3em;height:.3em;background:linear-gradient(to bottom right,#b9400c 50%,transparent 50%);border-radius:0 0 0 .06em}",
    ".dock.collapsed>:not(.brand){display:none}",
    ".dock.moving{animation:none;cursor:grabbing;opacity:.92}",
    ".dock.down .menu{bottom:auto;top:calc(100% + 8px)}",
    ".dock.left .menu{right:auto;left:0}",
    ".dock.moving,.dock.moving .brand{cursor:grabbing}",
    ".dock .brand{cursor:grab}",
    ".eye.off{color:var(--gx-blue);background:var(--gx-tint)}.eye.off:hover{color:var(--gx-blue-ink);background:var(--gx-tint-h)}",
    ".dock:has(>.menu.open:last-child) .dk[aria-haspopup]{color:var(--gx-blue);background:var(--gx-tint)}",
    ".dock.down .menu{animation-name:gx-down}",
    "@keyframes gx-down{from{opacity:0;transform:translateY(-6px)}}",
    ".hint::after{display:none}",
    "@keyframes dock-in{from{opacity:0;transform:translateY(14px)}}",
    // placing ghost: a see-through preview note that follows the pointer (free notes)
    ".gxn-note.pg{position:fixed;left:0;top:0;display:none;width:180px;min-height:110px;padding:26px 12px 40px;pointer-events:none;opacity:.8;animation:none;transform:translate3d(var(--x,0),var(--y,0),0) rotate(-3deg);will-change:transform;box-shadow:0 18px 34px -10px rgba(0,0,0,.45)}",
    ".gxn-note.pg.on{display:block}",
    ".pg-t{display:block;font:500 12.5px/1.6 'GXPN Mono',ui-monospace,monospace;color:rgba(28,25,23,.5)}",
    ".pg-h{position:absolute;left:10px;right:10px;bottom:10px;display:flex;align-items:center;justify-content:center;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.75);color:#1c1917;font:600 11px/1.25 " + UIF + ";letter-spacing:0;white-space:nowrap}",
    // remove target (top-center): hidden until a dragged note / placing ghost is pushed into the top edge (iOS-like)
    ".rmz{position:fixed;left:50%;top:14px;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;opacity:0;visibility:hidden;transform:translate(-50%,-18px) scale(.8);transform-origin:50% 0;transition:opacity .18s ease-out,transform .18s cubic-bezier(.2,.9,.3,1.2),visibility 0s linear .18s}",
    ".rmz.on{opacity:1;visibility:visible;transform:translate(-50%,0) scale(1);transition-delay:0s}",
    // iOS-like frosted glass circle: translucent + blurred until the note is over it, then a soft red with a ripple
    ".rmz-b{position:relative;display:flex;align-items:center;justify-content:center;width:52px;height:52px;box-sizing:border-box;border:1px solid rgba(255,255,255,.45);border-radius:50%;background:rgba(120,120,128,.22);-webkit-backdrop-filter:blur(18px) saturate(1.8);backdrop-filter:blur(18px) saturate(1.8);color:rgba(220,38,38,.9);box-shadow:0 8px 24px rgba(0,0,0,.14),inset 0 1px 0 rgba(255,255,255,.35);transition:width .28s cubic-bezier(.34,1.56,.64,1),height .28s cubic-bezier(.34,1.56,.64,1),background .2s,border-color .2s,color .2s,box-shadow .2s}",
    ".rmz.on:not(.hot) .rmz-b{animation:rmz-breathe 1.6s ease-in-out infinite}",
    ".rmz-b::after{content:'';position:absolute;inset:-1px;border-radius:50%;border:2px solid rgba(255,59,48,.35);opacity:0;pointer-events:none}",
    ".rmz.hot .rmz-b::after{animation:rmz-ring 1.1s ease-out infinite}",
    "@keyframes rmz-breathe{50%{transform:scale(1.06);background:rgba(120,120,128,.3)}}",
    "@keyframes rmz-ring{0%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(1.7)}}",
    ".rmz.hot .rmz-b{width:66px;height:66px;background:rgba(255,59,48,.62);border-color:rgba(255,255,255,.55);color:#fff;box-shadow:0 10px 28px rgba(255,59,48,.25),inset 0 1px 0 rgba(255,255,255,.4)}",
    ".rmz svg{width:24px;height:24px;overflow:visible;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}",
    ".rmz.hot svg{width:30px;height:30px;stroke-width:2}",
    ".rmz .lid{transform-box:view-box;transform-origin:16px 6px;transition:transform .2s cubic-bezier(.3,1.8,.5,1)}", // hinge at the lid's right end; overshoot = bounce
    ".rmz.hot .lid{transform:rotate(-20deg)}",
    ".rmz.hot.shut .lid{transform:none}",
    ".rmz.shut .rmz-b{animation:rmz-gulp .22s cubic-bezier(.2,.9,.3,1.4)}",
    "@keyframes rmz-gulp{40%{transform:scale(.88)}}",
    ".rmz-l{padding:5px 12px;border-radius:999px;background:rgba(255,255,255,.55);-webkit-backdrop-filter:blur(16px) saturate(1.6);backdrop-filter:blur(16px) saturate(1.6);border:1px solid rgba(255,255,255,.6);color:#d70015;box-shadow:0 6px 18px rgba(0,0,0,.18);font:600 12px/1.25 " + UIF + ";letter-spacing:0;text-transform:none;white-space:nowrap;opacity:0;transform:translateY(-4px);transition:opacity .15s,transform .15s}",
    ".rmz.hot .rmz-l{opacity:1;transform:none}",
    ".gxn-note.doomed{opacity:.6;transform:rotate(var(--r)) scale(.9)}",
    ".gxn-note.pg.doomed{transform:translate3d(var(--x,0),var(--y,0),0) rotate(-3deg) scale(.9)}",
    ".gxn-note.trashing{animation:none!important;pointer-events:none;opacity:0!important;transform:translate(var(--tx,0),var(--ty,0)) rotate(var(--r)) scale(0)!important;transition:transform .22s cubic-bezier(.4,0,1,1),opacity .22s ease-in!important}",
    ".fixed{z-index:3}", // HUD (remove zone included) stays above a dragged note (z-index 2)
    // dark-only touches that are not plain token swaps
    ":host([data-theme=dark]) .toast,:host([data-theme=dark]) .coord{border:1px solid #424858}",
    ":host([data-theme=dark]) .rmz-l{background:rgba(32,35,44,.6);border-color:rgba(255,255,255,.12);color:#ff9b9b}",
    ":host([data-theme=dark]) .rmz:not(.hot) .rmz-b{border-color:rgba(255,255,255,.14);background:rgba(160,165,180,.18);color:#ff8a80}",
    ":host([data-theme=dark]) .dock .brand,:host([data-theme=dark]) .hi-ic{box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)}",
    ":host([data-theme=dark]) .dock .brand:hover{box-shadow:inset 0 0 0 1px rgba(110,152,255,.4)}",
    ":host([data-theme=dark]) .cnt{box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}",
    ":host([data-theme=dark]) .status .help[aria-pressed=true]{box-shadow:inset 0 0 0 1px rgba(110,152,255,.45)}",
    ":host([data-theme=dark]) .status .sdot{box-shadow:0 0 0 3px rgba(110,152,255,.25)}",
    ":host([data-theme=dark]) .hl i{background:#3b5cb4}",
    "@media (prefers-reduced-motion:reduce){.gxn-note,.dock,.hint,.toast,.menu,.rmz,.rmz-b,.rmz-b::after{animation:none!important}.rmz,.rmz *,.gxn-note.dragging,.gxn-note.ghost,.gxn-note.pg{transition:none!important}.rmz,.rmz.on{transform:translateX(-50%)}.rmz.hot .lid{transform:none}.gxn-note.doomed{transform:rotate(var(--r))}.gxn-note.pg,.gxn-note.pg.doomed{transform:translate3d(var(--x,0),var(--y,0),0)}}",
  ].join("\n");

  var url = PN.normUrl(location.href);
  var key = PN.keyFor(location.href);
  var page = null;
  var visible = true;
  var settings = {};
  var lastWrite = 0;
  var placing = false;
  var ctxPoint = null;
  var nodes = {};
  var navIdx = -1;
  var dockWanted = false;
  var revealed = false; // "only when I open Page Notes": notes stay hidden until the user asks this session
  var dockExpanded = false; // "always, small" toolbar: expanded by a click this session
  var dockClosed = false; // ✕ on the dock (also saved as settings.dockHidden): hidden until the user adds a new note
  var guideOpen = true; // guide card visible for this placing session (compact mode starts closed)
  var mode = "free"; // placing mode: free | el (stick to element) | hl (highlight text)
  var draggingId = null; // note being dragged/resized: reposition() leaves it alone

  var SVG = {
    note: '<path d="M4 3h12v9l-4 4H4z"/><path d="M12 16v-4h4"/>',
    el: '<rect x="3" y="3" width="14" height="14" rx="2" stroke-dasharray="3 2.5"/><circle cx="10" cy="10" r="2"/>',
    hl: '<path d="M3 17h14M6 13.5l6.5-7.5 3 2.6-6.5 7.4H6z"/>',
    trash: '<path d="M4 6h12M8 6V4h4v2M6 6l1 11h6l1-11"/>',
    bin: '<g class="lid"><path d="M4 6h12M8 6V4h4v2"/></g><path d="M6 6l1 11h6l1-11M8.5 9v5M11.5 9v5"/>', // remove target: the lid opens on its own
    check: '<path d="M4.5 10.5 8 14l7.5-8.5"/>',
    info: '<circle cx="10" cy="10" r="7"/><path d="M10 9v4.5M10 6.5v.5"/>',
    list: '<path d="M7 5h9M7 10h9M7 15h9M3.5 5h.5M3.5 10h.5M3.5 15h.5"/>',
    eye: '<path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"/><path d="M3 3l14 14"/>',
    eyeOn: '<path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"/><circle cx="10" cy="10" r="2.5"/>',
    copy: '<rect x="6" y="6" width="10" height="11" rx="1.5"/><path d="M4 13V4.5A1.5 1.5 0 0 1 5.5 3H13"/>',
    next: '<path d="M10 4v12M5 11l5 5 5-5"/>',
    more: '<path d="M3.5 6.5h7M14.5 6.5h2M3.5 13.5h2M9.5 13.5h7"/><circle cx="12.5" cy="6.5" r="2"/><circle cx="7.5" cy="13.5" r="2"/>',
    x: '<path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/>',
    min: '<path d="M4 4h12v12H4z"/><path d="M7 12.5h6"/>',
    caret: '<path d="M2.5 7.5 6 4l3.5 3.5"/>',
    left: '<path d="M7.5 2.5 4 6l3.5 3.5"/>',
    right: '<path d="M4.5 2.5 8 6l-3.5 3.5"/>',
    gear: '<circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7"/>',
  };
  // real shortcuts from the worker; set before buildDock() below reads them
  var KEYS = {};
  var keyHooks = [];
  // ---------- mount ----------
  // an older copy (left behind by an extension reload/update) would show every note twice:
  // switch it off for good - hidden, not removed, because its observer would put it back
  document.querySelectorAll("gx-page-notes").forEach(function (old) {
    old.style.setProperty("display", "none", "important");
    old.setAttribute("data-gx-stale", "");
  });
  injectDocStyle();
  var host = document.createElement("gx-page-notes");
  host.setAttribute("style", "all:initial;position:absolute;left:0;top:0;width:0;height:0;z-index:2147483646;");
  var shadow = host.attachShadow({ mode: "closed" });
  var darkMq = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
  /** Apply settings.theme ("system" default | "light" | "dark") to the chrome: data-theme on the host. */
  function applyTheme() {
    var t = settings.theme;
    var dark = t === "dark" || (t !== "light" && !!(darkMq && darkMq.matches));
    if (dark) host.setAttribute("data-theme", "dark");
    else host.removeAttribute("data-theme");
  }
  applyTheme();
  if (darkMq) {
    if (darkMq.addEventListener) darkMq.addEventListener("change", applyTheme);
    else if (darkMq.addListener) darkMq.addListener(applyTheme);
  }
  var style = el("style");
  style.textContent = STYLES;
  var layer = el("div", "gxn-layer");
  var fixed = el("div", "fixed lab");
  var catcher = el("div", "catch");
  var gh = el("div", "gh");
  var gv = el("div", "gv");
  var coord = el("div", "coord");
  var tx = el("div", "tx"); // highlight mode: shows the text block under the cursor
  tx.appendChild(el("i", "", "✎ Select text here"));
  var hl = el("div", "hl");
  var hlTag = el("i");
  hl.appendChild(hlTag);
  var hint = el("div", "hint");
  var toast = el("div", "toast");
  // placing ghost (free notes) + top-edge remove target - both pointer-events:none, hit-tested by coordinates
  var pg = el("div", "gxn-note pg");
  pg.setAttribute("aria-hidden", "true");
  pg.append(el("span", "pg-t", "New note…"), el("span", "pg-h", "Click to place · Esc to cancel"));
  var rmz = el("div", "rmz");
  rmz.setAttribute("aria-hidden", "true");
  var rmzBtn = el("span", "rmz-b");
  rmzBtn.appendChild(svg("bin"));
  var rmzLabel = el("span", "rmz-l", "Release to delete");
  rmz.append(rmzBtn, rmzLabel);
  var dock = buildDock();
  fixed.append(hl, tx, gh, gv, coord, catcher, pg, rmz, hint, toast, dock.root);
  shadow.append(style, layer, fixed);
  document.documentElement.appendChild(host);

  // ---------- small helpers ----------
  /**
   * Create an element with an optional class and text.
   * @param {string} tag - tag name
   * @param {string} [cls] - class name(s)
   * @param {string} [text] - text content
   * @returns {HTMLElement}
   */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  /** Create a <kbd> key label. @param {string} t - key text @returns {HTMLElement} */
  function kbd(t) {
    return el("kbd", "", t);
  }
  // real shortcuts from the worker (users can change them in chrome://extensions/shortcuts); "" = not set
  /** Shortcut text for a command, with a leading space + parentheses for titles. @param {string} c @returns {string} */
  function keyHint(c) {
    return KEYS[c] ? " (" + KEYS[c] + ")" : "";
  }
  /** A <kbd> that shows a command's real shortcut (hidden when none). @param {string} c - command name @returns {HTMLElement} */
  function cmdKbd(c) {
    var k = kbd(KEYS[c] || "");
    k.hidden = !KEYS[c];
    keyHooks.push(function () {
      k.textContent = KEYS[c] || "";
      k.hidden = !KEYS[c];
    });
    return k;
  }
  /** Wrap nodes/strings in a <span>. @param {Array} parts - children @returns {HTMLElement} */
  function spanWith(parts) {
    var s = el("span");
    s.append.apply(s, parts);
    return s;
  }
  /**
   * Whether the extension context still exists (false after a reload/update).
   * @returns {boolean}
   */
  function alive() {
    try {
      return !!chrome.runtime && !!chrome.runtime.id;
    } catch (e) {
      return false;
    }
  }
  /**
   * Send a message to background.js; never throws.
   * @param {Object} msg - message with a `type`
   * @returns {Promise<Object|null>} the reply, or null on failure
   */
  function send(msg) {
    if (!alive()) return Promise.resolve(null);
    try {
      return chrome.runtime.sendMessage(msg).catch(function () {
        return null;
      });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  /** Text-highlight colors live in the document; the two UI fonts are handed over by the worker. */
  function injectDocStyle() {
    // replace (not skip) an older copy: a previous version's tag may still hold @font-face URLs
    var old = document.getElementById("gxpn-doc-style");
    if (old) old.remove();
    var s = document.createElement("style");
    s.id = "gxpn-doc-style";
    s.textContent = PN.COLORS.map(function (c, i) {
      return "::highlight(gxpn-" + i + "){background-color:" + c + "b3;color:inherit}";
    }).join("");
    (document.head || document.documentElement).appendChild(s);
    loadFonts();
  }
  /** The page never requests a chrome-extension:// URL: the worker reads the font files and sends
   *  their bytes, registered here with the FontFace API (fallback fonts if anything fails). */
  /** Asks the worker for the real shortcuts, then refreshes every key label. */
  function loadKeys() {
    send({ type: "keys" }).then(function (r) {
      if (!r || !r.keys) return;
      KEYS = r.keys;
      keyHooks.forEach(function (f) {
        f();
      });
    });
  }
  function loadFonts() {
    loadKeys();
    if (typeof FontFace === "undefined" || !document.fonts) return;
    send({ type: "fonts" }).then(function (r) {
      if (!r || !r.fonts) return;
      r.fonts.forEach(function (x) {
        try {
          var bin = atob(x.data);
          var buf = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
          var ff = new FontFace(x.family, buf.buffer, { weight: x.weight, display: "swap" });
          ff.load().then(
            function () {
              document.fonts.add(ff);
            },
            function () {},
          );
        } catch (e) {}
      });
    });
  }

  // ---------- storage ----------
  /** Read this page's record and the settings from storage, then render everything. */
  function load() {
    if (!alive()) return;
    chrome.storage.local.get("settings", function (s) {
      // inspect mode keeps its own notes: pick the key before reading the page
      PN.setDev(s.settings && s.settings.dev);
      key = PN.keyFor(location.href);
      chrome.storage.local.get(key, function (r) {
        page = r[key] || null;
        settings = s.settings || {};
        applyTheme();
        visible = wantVisible();
        host.style.display = visible ? "" : "none";
        renderAll();
        checkFocus();
        checkHash();
      });
    });
  }
  /** Return this page's record, creating an empty one if needed. @returns {Object} */
  function ensurePage() {
    if (!page) page = { url: url, title: document.title, favicon: favicon(), notes: [], updatedAt: Date.now() };
    return page;
  }
  var saveT = 0;
  /** Schedule a write of the page record (debounced). @param {boolean} [now] - write right away */
  function save(now) {
    clearTimeout(saveT);
    saveT = setTimeout(flush, now ? 0 : 350);
  }
  /** Write the page record to storage now (removed when it has no notes). */
  function flush() {
    clearTimeout(saveT);
    if (!page || !alive()) return;
    page.updatedAt = lastWrite = Date.now();
    page.title = document.title || page.title;
    page.favicon = favicon() || page.favicon;
    if (page.notes.length) {
      var o = {};
      o[key] = page;
      chrome.storage.local.set(o);
    } else chrome.storage.local.remove(key);
    count();
  }
  /** Tell the worker the note count (toolbar badge) and refresh the dock. */
  function count() {
    send({ type: "count", n: page ? page.notes.length : 0 });
    updateDock();
  }
  /** URL of the page's favicon. @returns {string} */
  function favicon() {
    var l = document.querySelector('link[rel~="icon"][href]');
    return l ? l.href : location.origin + "/favicon.ico";
  }
  var TYPES = { free: ["note", "Note"], el: ["el", "Element"], hl: ["hl", "Highlight"] };
  /** Note kind picked in the dock: "free", "el" or "hl". @returns {string} */
  function curType() {
    if (settings.dev) return "el"; // inspect mode: element notes only
    return TYPES[settings.noteType] ? settings.noteType : "free";
  }
  var tipsShown = false;
  /** Whether "Show tips" is on (default on). @returns {boolean} */
  function tipsOn() {
    return settings.tips !== false;
  }
  /**
   * Build an inline icon from the static SVG table.
   * @param {string} name - key in SVG
   * @param {number} [vb] - viewBox size (default 20)
   * @returns {Element}
   */
  function svg(name, vb) {
    var w = document.createElement("span");
    w.innerHTML = '<svg viewBox="0 0 ' + (vb || 20) + " " + (vb || 20) + '" aria-hidden="true">' + SVG[name] + "</svg>"; // static markup only
    return w.firstChild;
  }
  /** Merge into the settings and save them. @param {Object} patch - changed keys */
  function setSettings(patch) {
    for (var k in patch) settings[k] = patch[k];
    if (alive()) chrome.storage.local.set({ settings: settings });
  }

  // other tabs, the popup or the list changed storage: follow settings, page record and focus requests
  chrome.storage.onChanged.addListener(function (ch, area) {
    if (area !== "local") return;
    if (ch.settings) {
      var wasDev = !!settings.dev;
      settings = ch.settings.newValue || {};
      applyTheme();
      if (wasDev !== !!settings.dev) {
        // switched between normal and inspect notes: show the other set
        flush();
        stopPlacing();
        page = null;
        navIdx = -1;
        renderAll();
        return load();
      }
      setVisible(wantVisible(), true);
      if (!tipsOn()) hint.style.display = "none"; // Tips off anywhere → off on this page too
      updateDock();
    }
    if (ch[key]) {
      var nv = ch[key].newValue;
      if (nv && nv.updatedAt === lastWrite) return; // our own write
      page = nv || null;
      renderAll();
      count();
    }
    if (ch.focus && ch.focus.newValue) checkFocus();
  });

  // ---------- anchoring: element (Shift) ----------
  /**
   * Page element under a viewport point (our own overlay is ignored).
   * @param {number} cx - viewport x
   * @param {number} cy - viewport y
   * @returns {HTMLElement|null}
   */
  function under(cx, cy) {
    var prev = host.style.display;
    host.style.display = "none";
    var t = document.elementFromPoint(cx, cy);
    host.style.display = prev;
    while (t && t.parentElement && t !== document.body) {
      var r = t.getBoundingClientRect();
      if (r.width >= 12 && r.height >= 12 && !(t instanceof SVGElement && t.localName !== "svg")) break;
      t = t.parentElement;
    }
    return t && t !== document.body && t !== document.documentElement ? t : null;
  }
  /** Whether the element has a stable id that is unique on the page. @param {HTMLElement} n @returns {boolean} */
  function uniqueId(n) {
    if (!n.id || /\d{4,}|^[:_]|[:]/.test(n.id)) return false; // skip framework-generated ids
    try {
      return document.querySelectorAll("#" + CSS.escape(n.id)).length === 1;
    } catch (e) {
      return false;
    }
  }
  /** Build a CSS selector that finds this element again on the next visit. @param {HTMLElement} n @returns {string} */
  function selectorFor(n) {
    var parts = [];
    while (n && n.nodeType === 1 && n !== document.body && n !== document.documentElement) {
      if (uniqueId(n)) {
        parts.unshift("#" + CSS.escape(n.id));
        return parts.join(" > ");
      }
      var part = n.localName;
      var parent = n.parentElement;
      if (parent) {
        var same = Array.prototype.filter.call(parent.children, function (c) {
          return c.localName === n.localName;
        });
        if (same.length > 1) part += ":nth-of-type(" + (same.indexOf(n) + 1) + ")";
      }
      parts.unshift(part);
      n = parent;
    }
    parts.unshift("body");
    return parts.join(" > ");
  }
  /** Short readable text of an element (aria-label, alt, title or its text). @param {HTMLElement} n @returns {string} */
  function snippet(n) {
    if (!n) return "";
    var t = n.getAttribute && (n.getAttribute("aria-label") || n.getAttribute("alt") || n.getAttribute("title"));
    return String(t || n.innerText || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 90);
  }
  /**
   * Anchor data for a note stuck to an element: selector + where on the element it was dropped.
   * @param {HTMLElement} t - target element
   * @param {number} cx - viewport x
   * @param {number} cy - viewport y
   * @returns {Object} {sel, fx, dy}
   */
  function elementAnchor(t, cx, cy) {
    var r = t.getBoundingClientRect();
    return { sel: selectorFor(t), fx: r.width ? (cx - r.left) / r.width : 0, dy: cy - r.top };
  }
  /** Short tag#id.class label shown while picking an element. @param {HTMLElement} t @returns {string} */
  function label(t) {
    return t.localName + (t.id ? "#" + t.id : "") + (t.classList.length ? "." + Array.prototype.slice.call(t.classList, 0, 2).join(".") : "");
  }

  // ---------- anchoring: highlighted text ----------
  var index = null;
  var indexDirty = true;
  var hlRanges = {};
  /** Join all visible text nodes into one string with each node's start offset. @returns {Object} {nodes, starts, text} */
  function buildIndex() {
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentElement;
        if (!p || /^(script|style|noscript|textarea|template)$/.test(p.localName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    var list = [];
    var starts = [];
    var text = "";
    var n;
    while ((n = w.nextNode())) {
      list.push(n);
      starts.push(text.length);
      text += n.data;
    }
    return { nodes: list, starts: starts, text: text };
  }
  /** The text index, rebuilt only when the page content changed. @returns {Object} */
  function getIndex() {
    if (!index || indexDirty) {
      index = buildIndex();
      indexDirty = false;
    }
    return index;
  }
  /**
   * Convert a DOM position to an offset in the index text.
   * @param {Object} idx - text index
   * @param {Node} container - range container
   * @param {number} off - offset in the container
   * @returns {number} offset, or -1 if not found
   */
  function offsetOf(idx, container, off) {
    if (container.nodeType === 3) {
      var i = idx.nodes.indexOf(container);
      return i < 0 ? -1 : idx.starts[i] + off;
    }
    var r = document.createRange();
    r.setStart(container, off);
    for (var k = 0; k < idx.nodes.length; k++) if (r.comparePoint(idx.nodes[k], 0) >= 0) return idx.starts[k];
    return idx.text.length;
  }
  /** Convert an index offset back to {node, off} (binary search). @param {Object} idx @param {number} o @returns {Object} */
  function pointAt(idx, o) {
    var lo = 0;
    var hi = idx.nodes.length - 1;
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (idx.starts[mid] <= o) lo = mid;
      else hi = mid - 1;
    }
    return { node: idx.nodes[lo], off: Math.min(o - idx.starts[lo], idx.nodes[lo].data.length) };
  }
  /** DOM Range for index offsets s..e. @param {Object} idx @param {number} s @param {number} e @returns {Range} */
  function rangeFor(idx, s, e) {
    var a = pointAt(idx, s);
    var b = pointAt(idx, e);
    var r = document.createRange();
    r.setStart(a.node, a.off);
    r.setEnd(b.node, b.off);
    return r;
  }
  /** Selection → {text, prefix, suffix} measured on the page text itself. */
  /** @param {Selection} sel @returns {Object|null} */
  function hlFromSelection(sel) {
    var r = sel.getRangeAt(0);
    var idx = getIndex();
    var s = offsetOf(idx, r.startContainer, r.startOffset);
    var e = offsetOf(idx, r.endContainer, r.endOffset);
    if (s < 0 || e <= s) return null;
    e = Math.min(e, s + 600);
    return { text: idx.text.slice(s, e), prefix: idx.text.slice(Math.max(0, s - 32), s), suffix: idx.text.slice(e, e + 32) };
  }
  /**
   * Find saved highlighted text on the page; the match with the best prefix/suffix wins.
   * @param {Object} h - {text, prefix, suffix}
   * @returns {Range|null}
   */
  function findRange(h) {
    var idx = getIndex();
    var best = -1;
    var bestScore = -1;
    var i = idx.text.indexOf(h.text);
    while (i > -1) {
      var score = 0;
      var pre = idx.text.slice(Math.max(0, i - h.prefix.length), i);
      var suf = idx.text.slice(i + h.text.length, i + h.text.length + h.suffix.length);
      for (var k = 1; k <= pre.length && pre[pre.length - k] === h.prefix[h.prefix.length - k]; k++) score++;
      for (var j = 0; j < suf.length && suf[j] === h.suffix[j]; j++) score++;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
      i = idx.text.indexOf(h.text, i + 1);
    }
    return best < 0 ? null : rangeFor(idx, best, best + h.text.length);
  }
  /** Paint highlighted text with the CSS Custom Highlight API (one highlight per note color). */
  function applyHighlights() {
    if (!window.CSS || !CSS.highlights || typeof Highlight === "undefined") return;
    PN.COLORS.forEach(function (c, i) {
      var ranges = [];
      if (visible && page && !page.hide)
        page.notes.forEach(function (n) {
          if (n.hl && n.color === c && hlRanges[n.id]) ranges.push(hlRanges[n.id]);
        });
      if (!ranges.length) return CSS.highlights.delete("gxpn-" + i);
      var h = new Highlight();
      ranges.forEach(function (r) {
        h.add(r);
      });
      CSS.highlights.set("gxpn-" + i, h);
    });
  }

  // ---------- where a note sits (top-left of the card, document px) ----------
  /** Whether an element is rendered and visible. @param {HTMLElement} t @returns {boolean} */
  function shown(t) {
    if (!t.getClientRects().length) return false;
    if (t.checkVisibility) return t.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    return true;
  }
  /**
   * Document point a note is attached to: end of its text, its element, or {free:true}.
   * @param {Object} n - note
   * @returns {Object|null} null when the anchor is not found or hidden
   */
  function base(n) {
    if (n.hl) {
      var r = hlRanges[n.id];
      var box = r && (r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentElement);
      if (r && box && shown(box)) {
        var rects = r.getClientRects();
        var last = rects[rects.length - 1];
        if (last) return { x: last.right + scrollX, y: last.bottom + scrollY, d: { dx: 4, dy: 8 } };
      }
      return null;
    }
    if (n.anchor) {
      var t = null;
      try {
        t = document.querySelector(n.anchor.sel);
      } catch (e) {}
      if (t && shown(t)) {
        var b = t.getBoundingClientRect();
        return { x: b.left + scrollX + n.anchor.fx * b.width, y: b.top + scrollY + Math.max(0, Math.min(n.anchor.dy, b.height)), d: { dx: -20, dy: -20 }, target: t };
      }
      return null;
    }
    return { x: 0, y: 0, free: true };
  }
  /** Final card position of a note. @param {Object} n - note @returns {Object} {x, y, lost?} */
  function place(n) {
    var b = base(n);
    if (!b) return { x: n.x, y: n.y, lost: true };
    if (b.free) return { x: n.x, y: n.y };
    var o = n.off || b.d;
    return { x: b.x + o.dx, y: b.y + o.dy, target: b.target };
  }

  // ---------- notes ----------
  /** Rebuild every note card of this page from scratch. */
  function renderAll() {
    setTimeout(applyPageHide, 0);
    layer.textContent = "";
    nodes = {};
    hlRanges = {};
    indexDirty = true;
    if (page) {
      resolveHighlights();
      page.notes.forEach(build);
    }
    reposition();
    updateDock();
  }
  /** Find the text range of every highlight note again. */
  function resolveHighlights() {
    if (!page) return;
    page.notes.forEach(function (n) {
      if (n.hl) hlRanges[n.id] = findRange(n.hl);
    });
  }

  /**
   * Create the DOM card of one note (bar, buttons, text, meta, resize handle) and wire its events.
   * @param {Object} n - note
   * @returns {HTMLElement} the card root
   */
  /**
   * Note background: its color at the note's opacity (n.op, 0.3-1).
   * @param {Object} n - note
   * @returns {string} CSS color
   */
  function noteBg(n) {
    var a = n.op && n.op < 1 ? Math.round(n.op * 255).toString(16).padStart(2, "0") : "";
    return n.color + a;
  }
  /**
   * Small popover on a note with an opacity slider (30-100%). Closes on Esc, Enter or a click outside.
   * @param {Object} n - note
   * @param {HTMLElement} root - the note card
   */
  function opacityPop(n, root) {
    var old = root.querySelector(".gxn-op");
    if (old) return old.remove();
    var box = el("div", "gxn-op");
    var r = document.createElement("input");
    r.type = "range";
    r.min = "30";
    r.max = "100";
    r.step = "5";
    r.value = String(Math.round((n.op || 1) * 100));
    r.setAttribute("aria-label", "Note opacity");
    var out = document.createElement("output");
    out.textContent = r.value + "%";
    var head = el("div", "oh");
    head.append(el("span", "osw"), el("b", "", "Opacity"), out);
    box.append(head, r);
    /** Paint the track / swatch / thumb in the note's colour. */
    function tint() {
      box.style.setProperty("--oc", n.color);
      box.style.setProperty("--oc-lo", n.color + "4d"); // 30%
      box.style.setProperty("--oc-now", noteBg(n));
    }
    tint();
    r.oninput = function () {
      n.op = Number(r.value) / 100;
      if (n.op >= 1) delete n.op;
      out.textContent = r.value + "%";
      root.style.background = noteBg(n);
      tint();
    };
    r.onchange = function () {
      touch(n);
      save();
    };
    // UI lives in a closed shadow root: listen there for clicks on other parts of our UI, and on the document for page clicks
    var sr = root.getRootNode();
    function close(e) {
      if (e && e.composedPath().indexOf(box) > -1) return;
      if (e && e.currentTarget === document && sr.host && e.target === sr.host) return; // handled by the shadow root listener
      box.remove();
      document.removeEventListener("mousedown", close, true);
      if (sr !== document) sr.removeEventListener("mousedown", close, true);
    }
    r.onkeydown = function (e) {
      if (e.key === "Escape" || e.key === "Enter") {
        e.stopPropagation();
        close();
      }
    };
    ["mousedown", "pointerdown", "click", "dblclick"].forEach(function (t) {
      box.addEventListener(t, function (e) {
        e.stopPropagation(); // don't start a note drag / focus the text
      });
    });
    root.appendChild(box);
    setTimeout(function () {
      document.addEventListener("mousedown", close, true);
      if (sr !== document) sr.addEventListener("mousedown", close, true);
    });
    r.focus();
  }
  function build(n) {
    var root = el("div", "gxn-note");
    root.setAttribute("role", "note");
    root.style.background = noteBg(n);
    root.style.setProperty("--r", (((n.createdAt || 0) % 7) - 3) * 0.8 + "deg");
    var bar = el("div", "gxn-bar");
    var dots = PN.COLORS.map(function (c) {
      var d = el("button", "gxn-dot");
      d.type = "button";
      d.style.background = c;
      d.setAttribute("aria-label", "Color " + c);
      d.setAttribute("aria-pressed", String(c === n.color));
      d.onclick = function () {
        // the colour is already picked: a second click opens the opacity control
        if (c === n.color) return opacityPop(n, root);
        n.color = c;
        touch(n);
        root.style.background = noteBg(n);
        dots.forEach(function (x) {
          x.setAttribute("aria-pressed", String(x === d));
        });
        applyHighlights();
        save();
      };
      return d;
    });
    bar.append.apply(bar, dots);
    var grip = el("span", "gxn-sp");
    grip.title = "Drag to move";
    bar.appendChild(grip);
    var done = iconBtn("✓", "Mark as done", function () {
      n.done = !n.done;
      touch(n);
      sync(n);
      save(true);
    });
    var link = iconBtn("#", "Copy a link to this note", function () {
      copy(PN.noteLink(location.href.split("#")[0], n.id), "Link to this note copied");
    });
    var min = iconBtn("–", "Fold into a tab", function () {
      n.min = true;
      sync(n);
      save();
    });
    var del = iconBtn("✕", "Delete note", function () {
      remove(n, true); // straight away - the Undo bar in the corner brings it back
    });
    var flag = iconBtn("!", "Mark as urgent", function () {
      n.pri = n.pri === "urgent" ? "" : "urgent";
      touch(n);
      sync(n);
      save(true);
    });
    flag.classList.add("gxn-flag");
    bar.append(flag, done, link, min, del);
    var text = el("div", "gxn-text");
    try {
      text.contentEditable = "plaintext-only";
    } catch (e) {
      text.contentEditable = "true";
    }
    text.setAttribute("role", "textbox");
    text.setAttribute("aria-multiline", "true");
    text.setAttribute("aria-label", "Note text");
    text.dataset.ph = "Write a note…";
    text.textContent = n.text;
    // read mode: links become pills; click the text to edit again
    var view = el("div", "gxn-view");
    var refreshView = function () {
      var has = PN.links(n.text).length > 0 && shadow.activeElement !== text;
      root.classList.toggle("viewing", has);
      if (has) {
        view.textContent = "";
        view.appendChild(PN.rich(n.text));
      }
    };
    view.onclick = function (e) {
      if (e.target.closest("a")) return;
      root.classList.remove("viewing");
      text.focus();
      var r = document.createRange();
      r.selectNodeContents(text);
      r.collapse(false);
      var sel = getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(r);
      }
    };
    text.onfocus = function () {
      root.classList.remove("viewing");
    };
    text.oninput = function () {
      n.text = text.innerText.replace(/\n$/, "");
      touch(n);
      clearTimeout(text._t);
      text._t = setTimeout(function () {
        meta(n);
      }, 400);
      save();
    };
    text.onpaste = function (e) {
      // keep it plain text everywhere
      e.preventDefault();
      document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain"));
    };
    text.onblur = function () {
      // setting: fold a filled note once the user clicks away from it (not when clicking its own bar)
      if (settings.autoMin && n.text.trim() && !root.matches(":hover")) {
        n.min = true;
        sync(n);
        save();
      }
      setTimeout(refreshView, 0); // empty notes stay on the page until the user deletes them
      // finished writing → retake the snapshot so it shows the note with its text
      if (n.text !== root._shotText) setTimeout(function () {
        if (shadow.activeElement !== text) shootNote(n);
      }, 250);
    };
    var m = el("div", "gxn-meta");
    var stamp = el("span", "gxn-stamp", "Done");
    var num = el("button", "gxn-num");
    num.type = "button";
    num.setAttribute("aria-label", "Unfold note");
    var rs = el("span", "gxn-rs");
    rs.title = "Resize";
    root.append(bar, text, view, m, stamp, num, rs);
    if (n.w) {
      root.classList.add("sized");
      root.style.width = n.w + "px";
      root.style.height = n.h + "px";
    }
    layer.appendChild(root);
    nodes[n.id] = { root: root, text: text, meta: m, num: num, done: done, flag: flag };
    refreshView();
    resizable(rs, n, root);

    // the tape on top is a drag handle too - all of it, also the half sticking out above the note
    var tape = el("span", "gxn-tape");
    tape.setAttribute("aria-hidden", "true");
    root.appendChild(tape);
    draggable(grip, n, null);
    draggable(tape, n, null);
    draggable(num, n, function () {
      n.min = false;
      sync(n);
      text.focus();
      save();
    });
    root.onmouseenter = function () {
      var p = place(n);
      if (p.target && !placing) outline(p.target);
    };
    root.onmouseleave = function () {
      if (!placing) hl.style.display = "none";
    };
    sync(n);
    return root;
  }
  /**
   * Small button for a note's bar.
   * @param {string} t - button text/icon
   * @param {string} label_ - tooltip and aria-label
   * @param {Function} fn - click handler
   * @returns {HTMLElement}
   */
  function iconBtn(t, label_, fn) {
    var b = el("button", "gxn-x", t);
    b.type = "button";
    b.title = label_;
    b.setAttribute("aria-label", label_);
    b.onclick = fn;
    return b;
  }
  /** Mark a note as edited now. @param {Object} n */
  function touch(n) {
    n.updatedAt = Date.now();
  }
  /** 1-based position of a note in this page's list. @param {Object} n @returns {number} */
  function ordinal(n) {
    return page ? page.notes.indexOf(n) + 1 : 0;
  }
  /** Update a card's classes/attributes (folded, done...) from its note data. @param {Object} n */
  function sync(n) {
    var k = nodes[n.id];
    if (!k) return;
    k.root.classList.toggle("min", !!n.min);
    if (n.done) k.root.setAttribute("data-done", "");
    else k.root.removeAttribute("data-done");
    k.done.setAttribute("aria-pressed", String(!!n.done));
    k.root.classList.toggle("urgent", n.pri === "urgent");
    k.flag.setAttribute("aria-pressed", String(n.pri === "urgent"));
    k.num.textContent = PN.pad(ordinal(n));
    k.root.setAttribute("aria-label", "Page note " + ordinal(n) + (n.done ? " (done)" : ""));
    meta(n);
  }
  /** Fill the small info line of a card. @param {Object} n - note @param {boolean} lost - anchor not found */
  function meta(n, lost) {
    var k = nodes[n.id];
    if (!k) return;
    var m = k.meta;
    m.textContent = "";
    m.append(el("span", "", "#" + PN.pad(ordinal(n)) + " · " + PN.when(n.updatedAt || n.createdAt)));
    if (lost) m.append(el("span", "gxn-lost", n.hl ? "text changed" : "not visible"));
    else if (n.hl) m.append(el("span", "gxn-q", "▍“" + n.hl.text.replace(/\s+/g, " ").trim().slice(0, 40) + "”"));
    else if (n.anchor && n.quote) m.append(el("span", "gxn-q", "⌖ " + n.quote.slice(0, 32)));
    if (n.pri === "urgent") m.append(el("span", "gxn-urg", "URGENT"));
  }

  /** Keep a note inside the page horizontally (no sideways overflow) and below the top. */
  function clampX(x, w) {
    var pw = Math.max(document.documentElement.clientWidth, document.body ? document.body.scrollWidth : 0);
    return Math.max(4, Math.min(x, pw - w - 8));
  }
  /** @param {number} y @returns {number} */
  function clampY(y) {
    return Math.max(4, y);
  }
  /** Move every card to its current anchor position. */
  function reposition() {
    if (!page) return;
    page.notes.forEach(function (n) {
      var k = nodes[n.id];
      if (!k || n.id === draggingId) return;
      var p = place(n);
      // anchored to something hidden (closed menu, modal, tab...) -> only show when it's visible again
      k.root.style.display = p.lost && !k.forced ? "none" : "";
      k.root.style.left = clampX(p.x, k.root.offsetWidth || 190) + "px";
      k.root.style.top = clampY(p.y) + "px";
      if (!p.lost) {
        n.x = p.x;
        n.y = p.y;
      }
      if (!!k.lost !== !!p.lost) {
        k.lost = !!p.lost;
        meta(n, p.lost);
      }
    });
    applyHighlights();
  }
  var rpT = 0;
  var lastIndexAt = 0;
  /** Debounced reposition(). @param {boolean} [contentChanged] - also rebuild the text index */
  function scheduleReposition(contentChanged) {
    if (contentChanged) indexDirty = true;
    clearTimeout(rpT);
    rpT = setTimeout(function () {
      requestAnimationFrame(function () {
        // re-find highlighted text at most ~once a second
        if (indexDirty && page && page.notes.some(function (n) { return n.hl; }) && Date.now() - lastIndexAt > 900) {
          lastIndexAt = Date.now();
          resolveHighlights();
        }
        reposition();
      });
    }, 140);
  }

  /** Drag by the bar (or the folded tab) anywhere. Hold Shift on drop to stick it to the element underneath. */
  /** @param {HTMLElement} handle - drag handle @param {Object} n - note @param {Function} [onTap] - called on a click without drag */
  function draggable(handle, n, onTap) {
    handle.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      if (handle.classList.contains("gxn-bar") && e.target !== handle && e.target.closest("button")) return;
      e.preventDefault();
      var p = place(n);
      var sx = e.clientX;
      var sy = e.clientY;
      var moved = false;
      var root = nodes[n.id].root;
      handle.setPointerCapture(e.pointerId);
      var move = function (m) {
        var dx = m.clientX - sx;
        var dy = m.clientY - sy;
        if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
        if (!moved) {
          draggingId = n.id;
          root.classList.add("dragging");
        }
        // the remove target only appears when the note is pushed into the top edge
        root.classList.toggle("doomed", trackZone("Release to delete", m.clientX, m.clientY));
        moved = true;
        root.style.left = clampX(p.x + dx, root.offsetWidth) + "px";
        root.style.top = clampY(p.y + dy) + "px";
        root.style.zIndex = "2";
        if (m.shiftKey) {
          var t = under(m.clientX, m.clientY);
          if (t) outline(t);
        } else hl.style.display = "none";
      };
      var up = function (u) {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", up);
        root.style.zIndex = "";
        hl.style.display = "none";
        draggingId = null;
        var onZone = moved && u.type !== "pointercancel" && trackZone("Release to delete", u.clientX, u.clientY);
        root.classList.remove("dragging");
        if (onZone) {
          return trashNote(root, function () {
            remove(n, true); // same path as the ✕ button (Undo bar, settings)
          });
        }
        root.classList.remove("doomed");
        hideZone();
        if (!moved) {
          if (onTap) onTap();
          return;
        }
        var nx = clampX(p.x + (u.clientX - sx), root.offsetWidth);
        var ny = clampY(p.y + (u.clientY - sy));
        var t = u.shiftKey ? under(u.clientX, u.clientY) : null;
        if (t) {
          n.anchor = elementAnchor(t, u.clientX, u.clientY);
          n.hl = null;
          n.quote = snippet(t);
          n.off = null;
          var b = base(n);
          if (b) n.off = { dx: nx - b.x, dy: ny - b.y };
          say("Stuck to " + label(t));
        } else {
          var b2 = base(n);
          if (b2 && !b2.free) n.off = { dx: nx - b2.x, dy: ny - b2.y }; // keeps following its element/text
          n.x = nx;
          n.y = ny;
        }
        touch(n);
        reposition();
        save(true);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", up);
    });
  }

  /** Corner handle: resize between 160x110 and 460x480 (saved as n.w / n.h). */
  /** @param {HTMLElement} handle @param {Object} n - note @param {HTMLElement} root - card */
  function resizable(handle, n, root) {
    handle.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      var sx = e.clientX;
      var sy = e.clientY;
      var w0 = root.offsetWidth;
      var h0 = root.offsetHeight;
      draggingId = n.id;
      root.classList.add("resizing", "sized");
      handle.setPointerCapture(e.pointerId);
      var move = function (m) {
        root.style.width = Math.max(160, Math.min(460, innerWidth - 24, w0 + m.clientX - sx)) + "px";
        root.style.height = Math.max(110, Math.min(480, innerHeight - 24, h0 + m.clientY - sy)) + "px";
      };
      var up = function () {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", up);
        draggingId = null;
        root.classList.remove("resizing");
        n.w = root.offsetWidth;
        n.h = root.offsetHeight;
        touch(n);
        reposition();
        save(true);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", up);
    });
  }

  /** opts: {cx, cy, target?, hl?, quote?} — viewport coords of the spot the user chose. */
  /** Create, save and show a new note. @param {Object} opts @returns {Object} the new note */
  function create(opts) {
    if (!visible) setVisible(true);
    reopenDock(); // a new note brings the toolbar back
    if (page && page.hide) setPageHidden(false); // ...and the page's notes
    ensurePage();
    var now = Date.now();
    var n = { id: PN.uid(), text: "", color: PN.COLORS[page.notes.length % PN.COLORS.length], x: opts.cx + scrollX - 20, y: opts.cy + scrollY - 20, anchor: null, hl: null, off: null, quote: "", done: false, min: false, createdAt: now, updatedAt: now };
    if (opts.hl) {
      n.hl = opts.hl;
      n.color = PN.COLORS[0];
      n.quote = opts.hl.text.replace(/\s+/g, " ").trim().slice(0, 160);
    } else if (opts.target) {
      n.anchor = elementAnchor(opts.target, opts.cx, opts.cy);
      n.quote = snippet(opts.target);
    }
    page.notes.push(n);
    if (n.hl) hlRanges[n.id] = findRange(n.hl);
    var root = build(n);
    reposition();
    updateDock();
    // snapshot with the note on it (retaken when the user finishes writing)
    shootNote(n).then(function () {
      var k = nodes[n.id];
      if (k) k.text.focus({ preventScroll: true });
      save(true);
    });
    return n;
  }

  /** Snapshot centered on the note itself (visible in the picture). */
  /** @param {Object} n - note @returns {Promise<void>} */
  function shootNote(n) {
    var k = nodes[n.id];
    if (!k || !visible) return Promise.resolve();
    var r = k.root.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return Promise.resolve(); // off screen: keep the old one
    k.root._shotText = n.text;
    return shoot(n.id, r.left + r.width / 2, r.top + r.height / 2);
  }
  /** Ask the worker for a cropped screenshot around the spot (shown in “All my notes”). */
  /** @param {string} id - note id @param {number} cx - viewport x @param {number} cy - viewport y @returns {Promise<void>} */
  function shoot(id, cx, cy) {
    if (settings.snapshots === false) return Promise.resolve();
    // the HUD (dock, guides, outline) must not end up in the picture
    fixed.style.visibility = "hidden";
    hint.style.display = "none";
    hl.style.display = gh.style.display = gv.style.display = coord.style.display = "none";
    return new Promise(function (res) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          var done = false;
          var fin = function () {
            if (done) return;
            done = true;
            fixed.style.visibility = "";
            res();
          };
          setTimeout(fin, 900);
          send({ type: "shot", id: id, x: cx, y: cy, vw: innerWidth, vh: innerHeight }).then(fin);
        });
      });
    });
  }

  /**
   * Delete one note; its snapshot is removed a few seconds later unless undone.
   * @param {Object} n - note
   * @param {boolean} undoable - offer an Undo bar (only if the note had content)
   */
  function remove(n, undoable) {
    if (!page) return;
    var i = page.notes.indexOf(n);
    if (i < 0) return;
    page.notes.splice(i, 1);
    var hadText = !!n.text.trim() || !!n.hl;
    renderAll();
    flush();
    hl.style.display = "none";
    var undone = false;
    setTimeout(function () {
      if (!undone && alive()) chrome.storage.local.remove(PN.SHOT + n.id);
    }, 6000);
    if (undoable && hadText)
      say("Note deleted", "Undo", function () {
        undone = true;
        ensurePage().notes.splice(Math.min(i, page.notes.length), 0, n);
        renderAll();
        save(true);
      });
  }

  /** Inspect mode: delete every note on this site (all its pages) — with an Undo bar. */
  function removeSite() {
    chrome.storage.local.get(null, function (store) {
      var site = PN.host(url);
      var pages = PN.allPages(store).filter(function (p) {
        return PN.host(p.url) === site && p.url !== url;
      });
      var cnt = (page ? page.notes.length : 0) + pages.reduce(function (a, p) { return a + p.notes.length; }, 0);
      if (!cnt) return say("No notes on this site");
      askConfirm(cnt === 1 ? "Delete 1 note?" : "Delete all " + cnt + " notes?", "Every note on " + site + " will be removed.", "Delete all", function () {
        var others = {};
        pages.forEach(function (p) {
          others[PN.PREFIX + p.url] = p;
        });
        chrome.storage.local.remove(Object.keys(others));
        var old = page ? page.notes.slice() : [];
        var gone = pages.reduce(function (a, p) { return a.concat(p.notes); }, old.slice());
        if (page) page.notes = [];
        renderAll();
        flush();
        hl.style.display = "none";
        var undone = false;
        setTimeout(function () {
          if (!undone && alive()) chrome.storage.local.remove(gone.map(function (n) { return PN.SHOT + n.id; }));
        }, 6500);
        say(cnt === 1 ? "1 note deleted" : cnt + " notes deleted", "Undo", function () {
          undone = true;
          chrome.storage.local.set(others);
          if (old.length) {
            ensurePage().notes = old.concat(page.notes);
            renderAll();
            save(true);
          }
        });
      });
    });
  }
  /** Delete every note on this page — with an Undo bar (or a confirm when Undo is turned off). */
  function removeAll() {
    if (settings.dev) return removeSite();
    if (!page || !page.notes.length) return say("No notes on this page");
    var cnt = page.notes.length;
    askConfirm(cnt === 1 ? "Delete 1 note?" : "Delete all " + cnt + " notes?", "Every note on this page will be removed.", "Delete all", reallyRemoveAll);
  }
  /** Delete all notes of this page now (keeps a copy for Undo). */
  function reallyRemoveAll() {
    if (!page || !page.notes.length) return;
    var old = page.notes.slice();
    var msg = old.length === 1 ? "1 note deleted" : old.length + " notes deleted";
    page.notes = [];
    renderAll();
    flush();
    hl.style.display = "none";
    var undone = false;
    setTimeout(function () {
      if (!undone && alive())
        chrome.storage.local.remove(
          old.map(function (n) {
            return PN.SHOT + n.id;
          }),
        );
    }, 6500);
    say(msg, "Undo", function () {
      undone = true;
      ensurePage().notes = old.concat(page.notes);
      renderAll();
      save(true);
    });
  }

  // ---------- placing mode (free by default, Shift = stick to element) ----------
  /** Draw the outline + label around an element while placing. @param {HTMLElement} t */
  function outline(t) {
    var r = t.getBoundingClientRect();
    Object.assign(hl.style, { display: "block", left: r.left - 3 + "px", top: r.top - 3 + "px", width: r.width + 6 + "px", height: r.height + 6 + "px" });
    hlTag.textContent = "⌖ " + label(t);
  }
  var mvRaf = 0;
  /**
   * Show the crosshair guides and coordinates at a point.
   * @param {number} cx - viewport x
   * @param {number} cy - viewport y
   * @param {boolean} snap - element mode style
   */
  function guides(cx, cy, snap) {
    fixed.classList.toggle("snap", !!snap);
    gh.style.display = gv.style.display = "block";
    coord.style.display = "flex";
    gh.style.top = cy + "px";
    gv.style.left = cx + "px";
    coord.style.left = Math.min(cx + 14, innerWidth - 150) + "px";
    coord.style.top = Math.min(cy + 14, innerHeight - 30) + "px";
    coord.textContent = "";
    var ty = placing ? mode : curType();
    var chip = el("span", "ai t-" + ty);
    chip.append(svg(TYPES[ty][0]));
    coord.append(chip);
    var cx_ = el("span", "cxy");
    coord.append(cx_);
    cx_.append("X ", el("b", "", String(Math.round(cx + scrollX)).padStart(4, "0")), " · Y ", el("b", "", String(Math.round(cy + scrollY)).padStart(4, "0")), snap ? " · STICK" : "");
  }
  // ---- placing ghost + remove zone ----
  var lastPt = null; // last known pointer position (viewport), so a ghost started from the popup / keyboard shows near it
  document.addEventListener(
    "mousemove",
    function (e) {
      lastPt = { x: e.clientX, y: e.clientY };
    },
    { capture: true, passive: true },
  );
  var PG_W = 180;
  var PG_H = 110;
  var PG_GAP = 14; // ghost sits this far from the pointer (to its bottom-right; bottom-left on RTL pages)
  /**
   * Ghost top-left (viewport) for a pointer position, kept inside the viewport.
   * Clicking uses the same math, so the note lands exactly where the ghost was.
   * @param {number} cx @param {number} cy @returns {{x:number, y:number}}
   */
  function ghostAt(cx, cy) {
    var rtl = getComputedStyle(document.documentElement).direction === "rtl";
    var x = rtl ? cx - PG_GAP - PG_W : cx + PG_GAP;
    var y = cy + PG_GAP;
    return { x: Math.max(4, Math.min(x, innerWidth - PG_W - 4)), y: Math.max(4, Math.min(y, innerHeight - PG_H - 4)) };
  }
  /** Show the ghost at a pointer position (or the viewport center when null). @param {?{x:number,y:number}} pt */
  function moveGhost(pt) {
    var g = pt ? ghostAt(pt.x, pt.y) : { x: (innerWidth - PG_W) / 2, y: (innerHeight - PG_H) / 2 };
    pg.style.setProperty("--x", Math.round(g.x) + "px");
    pg.style.setProperty("--y", Math.round(g.y) + "px");
    if (!pg.classList.contains("on")) {
      pg.style.background = PN.COLORS[(page ? page.notes.length : 0) % PN.COLORS.length]; // the color the note will get
      pg.classList.add("on");
    }
  }
  /** Hide the ghost. */
  function hideGhost() {
    pg.classList.remove("on", "doomed");
  }
  var EDGE_IN = 72; // pointer above this (viewport px) shows + arms the remove target
  var EDGE_OUT = 110; // ...and below this hides it again (hysteresis)
  var ARM_R = 90; // armed only within this radius of the trash button (the rest of the top edge still accepts notes)
  var trashTimer = 0;
  /** Whether the user asked for reduced motion. @returns {boolean} */
  function calm() {
    return !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  /**
   * Top-edge remove target (iOS-like): hidden until the pointer enters the top edge, armed near it.
   * @param {string} text - label shown while armed
   * @param {number} cx @param {number} cy - pointer (viewport)
   * @returns {boolean} armed (a release / click here removes or cancels)
   */
  function trackZone(text, cx, cy) {
    var on = rmz.classList.contains("on");
    if (!on && cy < EDGE_IN) {
      clearTimeout(trashTimer);
      rmz.classList.remove("shut");
      rmzLabel.textContent = text;
      rmz.classList.add("on");
      on = true;
    } else if (on && cy > EDGE_OUT) {
      hideZone();
      return false;
    }
    if (!on) return false;
    var r = rmzBtn.getBoundingClientRect();
    var armed = Math.hypot(cx - (r.left + r.width / 2), cy - (r.top + r.height / 2)) <= ARM_R;
    rmz.classList.toggle("hot", armed);
    return armed;
  }
  /** Hide the remove target. */
  function hideZone() {
    clearTimeout(trashTimer);
    rmz.classList.remove("on", "hot", "shut");
  }
  /**
   * Delete animation: the card shrinks into the trash, the lid closes, then `done` runs.
   * @param {HTMLElement} card - the dropped note @param {Function} done - the actual removal
   */
  function trashNote(card, done) {
    if (calm()) {
      hideZone();
      return done();
    }
    var b = rmzBtn.getBoundingClientRect();
    var r = card.getBoundingClientRect();
    card.style.setProperty("--tx", Math.round(b.left + b.width / 2 - (r.left + r.width / 2)) + "px");
    card.style.setProperty("--ty", Math.round(b.top + b.height / 2 - (r.top + r.height / 2)) + "px");
    card.classList.add("trashing");
    clearTimeout(trashTimer);
    trashTimer = setTimeout(function () {
      rmz.classList.add("shut"); // lid closes with a little bounce
      trashTimer = setTimeout(function () {
        done();
        hideZone();
      }, 170);
    }, 220);
  }
  /** Free-note ghost on or off - element / text modes keep the guides. The cancel target shows at the top edge only. */
  function syncGhost() {
    if (placing && mode === "free") {
      moveGhost(lastPt);
    } else {
      hideGhost();
      hideZone();
    }
  }

  catcher.addEventListener("mousemove", function (e) {
    cancelAnimationFrame(mvRaf);
    mvRaf = requestAnimationFrame(function () {
      if (!placing) return;
      var stick = e.shiftKey || mode === "el";
      if (!stick) {
        // free note: the ghost follows the pointer instead of the crosshair guides
        gh.style.display = gv.style.display = coord.style.display = hl.style.display = "none";
        moveGhost({ x: e.clientX, y: e.clientY });
        pg.classList.toggle("doomed", trackZone("Click to cancel", e.clientX, e.clientY));
        return;
      }
      hideGhost();
      hideZone();
      guides(e.clientX, e.clientY, stick);
      var t = stick ? under(e.clientX, e.clientY) : null;
      if (t) outline(t);
      else hl.style.display = "none";
    });
  });
  // Note (general) mode: click = note · Shift+click = element · drag over text = highlight
  var skipClick = false;
  /** Text caret range at a viewport point (hit-tests the page, not our overlay). @returns {Range|null} */
  function caretAt(cx, cy) {
    if (!document.caretRangeFromPoint) return null;
    var pe = catcher.style.pointerEvents;
    catcher.style.pointerEvents = "none"; // hit-test the page, not our overlay (display:none would cancel the click)
    var r = document.caretRangeFromPoint(cx, cy);
    catcher.style.pointerEvents = pe;
    return r && r.startContainer.nodeType === 3 ? r : null;
  }
  // Over text (Note mode) the overlay lets the mouse through: native text cursor + selection.
  var overText = false;
  /** Let clicks reach the page text (to select it) or catch them again. @param {boolean} v */
  function setOverText(v) {
    overText = v;
    catcher.style.pointerEvents = v ? "none" : "";
    if (!v) tx.style.display = "none";
  }
  // Note mode stays a plain "click to pin": text (T / Alt+Shift+L) and elements (Shift, E / Alt+Shift+E) only on shortcut
  catcher.addEventListener("click", function (e) {
    e.preventDefault();
    if (skipClick) return; // that was a text drag, not a click
    var t = e.shiftKey || mode === "el" ? under(e.clientX, e.clientY) : null;
    if (mode === "el" && !t) return; // element mode: only an element can take the note
    if (!t && trackZone("Click to cancel", e.clientX, e.clientY)) return stopPlacing(); // clicked the armed cancel target
    stopPlacing();
    if (t) return create({ cx: e.clientX, cy: e.clientY, target: t });
    // free note: its top-left = the ghost's top-left (create() puts the card 20px up-left of cx/cy)
    var g = ghostAt(e.clientX, e.clientY);
    create({ cx: g.x + 20, cy: g.y + 20 });
  });
  var HINTS = {
    free: ["note", "Click anywhere to pin a note", [["Shift", "+ click: element"], ["T", "text"], ["E", "elements"], ["Esc", "cancel"]]],
    el: ["el", "Click a button, image or block", [["", "the note will follow it"], ["N", "note"], ["T", "text"], ["Esc", "cancel"]]],
    hl: ["hl", "Select the text you want to highlight", [["", "a note is added next to it"], ["N", "note"], ["E", "element"], ["Esc", "cancel"]]],
  };
  /** Show or hide the placing hint / guide card for the current mode. */
  function showHint() {
    var canGuide = placing && tipsOn() && settings.guide !== false;
    if (dock) {
      dock.help.style.display = canGuide ? "" : "none";
      dock.help.setAttribute("aria-pressed", String(canGuide && guideOpen));
    }
    if (!canGuide || !guideOpen) return (hint.style.display = "none");
    var h_ = HINTS[mode];
    hint.textContent = "";
    var ic = el("span", "hi-ic");
    ic.append(svg(h_[0]));
    var tx = el("span", "hi-tx");
    var sm = el("small");
    h_[2].forEach(function (k) {
      var sp = el("span");
      if (k[0]) sp.append(kbd(k[0]));
      sp.append(k[1]);
      sm.append(sp);
    });
    tx.append(el("b", "", h_[1]), sm);
    var x = el("button", "hi-x");
    x.type = "button";
    x.title = "Hide the guide";
    x.append(svg("x"));
    x.onclick = function () {
      guideOpen = false;
      showHint();
    };
    hint.append(ic, tx, x);
    hint.style.display = "flex";
    tipsShown = true;
  }
  /** Change the kind of note while placing (N / E / T keys). */
  /** @param {string} m - "free" | "el" | "hl" */
  function switchMode(m) {
    if (!placing || mode === m || (settings.dev && m !== "el")) return;
    mode = m;
    if (overText) setOverText(false);
    tx.style.display = hl.style.display = "none";
    catcher.style.display = mode === "hl" ? "none" : "block";
    gh.style.display = gv.style.display = coord.style.display = "none";
    syncGhost();
    updateDock();
    showHint();
  }
  /** m: "free" (default) | "el" stick to an element | "hl" highlight text */
  /** Enter placing mode (a selection already on the page becomes a highlight note). @param {string} [m] */
  function startPlacing(m) {
    if (!visible) setVisible(true);
    mode = settings.dev ? "el" : m || curType();
    var sel = getSelection();
    var hasSel = sel && !sel.isCollapsed && String(sel).trim().length > 1 && !host.contains(sel.anchorNode);
    if (hasSel && mode !== "el") return highlightSelection(sel);
    placing = true;
    dockWanted = true;
    reopenDock();
    guideOpen = settings.guideMode !== "compact";
    catcher.style.display = mode === "hl" ? "none" : "block"; // highlight mode: let the user select text
    syncGhost(); // free note: ghost at the last pointer position (or the center) right away
    updateDock();
    showHint();
  }
  // highlight mode: the crosshair follows the mouse while the user selects text
  document.addEventListener(
    "mousemove",
    function (e) {
      if (!placing || mode !== "hl") return;
      cancelAnimationFrame(mvRaf);
      mvRaf = requestAnimationFrame(function () {
        if (!(placing && mode === "hl")) return;
        guides(e.clientX, e.clientY, false);
        textUnder(e.clientX, e.clientY);
      });
    },
    true,
  );
  /** Highlight mode: outline the text block under the cursor so users see what can be selected. */
  /** @param {number} cx - viewport x @param {number} cy - viewport y */
  function textUnder(cx, cy) {
    var r = document.caretRangeFromPoint ? document.caretRangeFromPoint(cx, cy) : null;
    var node = r && r.startContainer;
    if (node && node.nodeType === 3 && node.textContent.trim().length > 1) {
      var rr = document.createRange();
      rr.selectNodeContents(node);
      var b = rr.getBoundingClientRect();
      if (b.width && cx >= b.left - 6 && cx <= b.right + 6 && cy >= b.top - 6 && cy <= b.bottom + 6) {
        Object.assign(tx.style, { display: "block", left: b.left - 4 + "px", top: b.top - 3 + "px", width: b.width + 8 + "px", height: b.height + 6 + "px" });
        return;
      }
    }
    tx.style.display = "none";
  }
  // highlight mode: as soon as the user finishes a text selection, turn it into a note
  document.addEventListener("mouseup", function (e) {
    if (!placing || mode !== "hl" || e.target === host) return;
    setTimeout(function () {
      var sel = getSelection();
      if (sel && !sel.isCollapsed && String(sel).trim().length > 1) {
        stopPlacing();
        highlightSelection(sel);
      }
    }, 0);
  });
  /** Leave placing mode and hide its HUD (guides, outline, hint). */
  function stopPlacing() {
    if (placing && tipsShown && settings.tips === undefined) setSettings({ tips: false }); // seen once → off until wanted again
    tipsShown = false;
    placing = false;
    if (overText) setOverText(false);
    mode = "free";
    guideOpen = false;
    cancelAnimationFrame(mvRaf);
    catcher.style.display = "none";
    hint.style.display = "none";
    hl.style.display = gh.style.display = gv.style.display = coord.style.display = tx.style.display = "none";
    hideGhost();
    if (!draggingId) hideZone(); // a note drag keeps its own zone
    updateDock();
  }
  /**
   * Turn the current text selection into a highlight note placed at its end.
   * @param {Selection} sel
   * @returns {boolean} true when a note was created
   */
  function highlightSelection(sel) {
    var h = hlFromSelection(sel);
    if (!h || !h.text.trim()) return false;
    var rects = sel.getRangeAt(0).getClientRects();
    var last = rects[rects.length - 1] || sel.getRangeAt(0).getBoundingClientRect();
    sel.removeAllRanges();
    dockWanted = true;
    create({ cx: last.right, cy: last.bottom, hl: h });
    return true;
  }
  // keys: Escape closes the confirm dialog or leaves placing mode; N / E / T switch mode
  window.addEventListener(
    "keydown",
    function (e) {
      if (e.key === "Escape" && cfm && cfm.classList.contains("on")) {
        e.stopPropagation();
        return cfm.classList.remove("on");
      }
      if (!placing) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        stopPlacing();
        return;
      }
      // while placing only: N / E / T switch the kind of note (never while typing)
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.target === host) return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      var k = { n: "free", e: "el", t: "hl" }[(e.key || "").toLowerCase()];
      if (!k) return;
      e.preventDefault();
      e.stopPropagation();
      switchMode(k);
    },
    true,
  );
  // remember where the context menu opened (for "Pin a Page Note here" from the worker)
  document.addEventListener(
    "contextmenu",
    function (e) {
      if (placing) {
        // right click cancels placing (no browser menu)
        e.preventDefault();
        e.stopPropagation();
        return stopPlacing();
      }
      if (e.target === host) return;
      ctxPoint = { x: e.clientX, y: e.clientY, sx: scrollX, sy: scrollY, target: e.target };
    },
    true,
  );

  // keep typing in a note from triggering the site's own keyboard shortcuts
  // (typing still works: we stop propagation, not the default action)
  ["keydown", "keyup", "keypress"].forEach(function (t) {
    window.addEventListener(
      t,
      function (e) {
        if (e.target !== host) return;
        e.stopImmediatePropagation();
        if (t === "keydown" && e.key === "Escape" && shadow.activeElement) shadow.activeElement.blur();
      },
      true,
    );
  });

  // ---------- dock ----------
  /**
   * Build the floating toolbar: brand, note navigation, add/split button, status, eye, menus.
   * @returns {Object} the root element plus the parts other code updates (cnt, menu, modes, eye...)
   */
  function buildDock() {
    var root = el("div", "dock");
    root.setAttribute("role", "toolbar");
    root.setAttribute("aria-label", "Page Notes");
    var brand = el("button", "brand");
    brand.type = "button";
    brand.title = "Page Notes";
    var cnt = el("span", "cnt", "0");
    brand.append(el("span", "mark"), cnt);
    brand.onclick = function () {
      if (brand._dragged) return (brand._dragged = false); // that was a move, not a click
      if ((settings.dock || "auto") === "mini") dockExpanded = !dockExpanded;
      else setSettings({ dockFolded: !settings.dockFolded });
      closeMenus();
      updateDock();
    };
    // drag the toolbar by its logo; on release it snaps to the nearest side, keeping its height
    var startDrag = function (e, handle) {
      if (e.button !== 0) return;
      var r0 = root.getBoundingClientRect();
      var sx = e.clientX;
      var sy = e.clientY;
      var moved = false;
      handle.setPointerCapture(e.pointerId);
      var move = function (m) {
        var dx = m.clientX - sx;
        var dy = m.clientY - sy;
        if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return;
        moved = true;
        closeMenus();
        root.classList.add("moving");
        var left = Math.max(4, Math.min(innerWidth - r0.width - 4, r0.left + dx));
        var top = Math.max(4, Math.min(innerHeight - r0.height - 4, r0.top + dy));
        root.style.left = left + "px";
        root.style.right = "auto";
        root.style.bottom = innerHeight - top - r0.height + "px";
      };
      var up = function () {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", up);
        root.classList.remove("moving");
        if (!moved) return;
        brand._dragged = true;
        setTimeout(function () {
          brand._dragged = false;
        }, 0);
        var r = root.getBoundingClientRect();
        var side = r.left + r.width / 2 < innerWidth / 2 ? "l" : "r";
        setSettings({ dockPos: { side: side, b: Math.round(innerHeight - r.bottom) } });
        placeDock();
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", up);
    };
    brand.addEventListener("pointerdown", function (e) {
      startDrag(e, brand);
    });

    // split button: [+ Note] places a simple note (or drag it out) | [caret] picks the kind of note
    var split = el("div", "split");
    var add = el("button", "new");
    add.type = "button";
    add.title = "Click, then click the page - or drag me onto the page";
    dragToCreate(add);
    var caret = el("button", "caret");
    caret.type = "button";
    caret.title = "Choose the kind of note";
    caret.setAttribute("aria-haspopup", "menu");
    caret.setAttribute("aria-expanded", "false");
    caret.append(svg("caret", 12));
    split.append(add, caret);

    var nav = el("div", "nav");
    var prev = el("button");
    prev.type = "button";
    prev.title = "Previous note";
    prev.append(svg("left", 12));
    var pos = el("span", "pos");
    var next = el("button");
    next.type = "button";
    next.title = "Next note";
    next.append(svg("right", 12));
    prev.onclick = function () {
      step(-1);
    };
    next.onclick = function () {
      step(1);
    };
    nav.append(prev, pos, next);

    // placing status: replaces the toolbar while a note is being placed
    var status = el("div", "status");
    var stLabel = el("span", "st-l");
    var help = el("button", "help", "?");
    help.type = "button";
    help.title = "How does it work?";
    help.onclick = function () {
      guideOpen = !guideOpen;
      showHint();
    };
    var cancel = el("button", "cancel", "Cancel");
    cancel.type = "button";
    cancel.title = "Cancel (Esc)";
    cancel.onclick = stopPlacing;
    status.append(el("span", "sdot"), stLabel, help, cancel);

    var more = el("button", "dk");
    more.type = "button";
    more.title = "Options";
    more.setAttribute("aria-haspopup", "menu");
    more.append(svg("more"));
    var fold = el("button", "dk");
    fold.type = "button";
    fold.title = "Minimize all notes on this page";
    fold.setAttribute("aria-label", fold.title);
    fold.append(svg("min"));
    fold.onclick = function () {
      if (!page) return;
      page.notes.forEach(function (n) {
        n.min = true;
        sync(n);
      });
      save();
    };
    var eye = el("button", "dk eye");
    eye.type = "button";
    eye.onclick = function () {
      setPageHidden(!pageHidden());
    };
    var close = el("button", "dk");
    close.type = "button";
    close.title = "Close the toolbar (your notes stay)";
    close.append(svg("x"));
    close.onclick = function () {
      closeMenus();
      // done working: hide the toolbar and the notes (Alt+Shift+H, Settings or a new note brings them back)
      dockClosed = true; // toolbar only - the notes stay as they are
      setSettings({ dockHidden: true }); // remembered: stays closed until the next new note
      if (settings.dockFolded) setSettings({ dockFolded: false });
      updateDock();
    };

    var item = function (menu, ic, tone, title, sub, k, fn) {
      var b = el("button");
      b.type = "button";
      b.setAttribute("role", "menuitem");
      var i = el("span", "mi" + (tone ? " " + tone : ""));
      i.append(svg(ic));
      var t = el("span", "mt");
      t.append(el("b", "", title), el("small", "", sub));
      b.title = sub;
      b.append(i, t);
      if (k) b.append(cmdKbd(k));
      b.onclick = function () {
        closeMenus();
        fn();
      };
      menu.appendChild(b);
      return b;
    };

    var modes = el("div", "menu");
    modes.setAttribute("role", "menu");
    modes.classList.add("desc");
    modes.append(el("div", "mh", "Type of note"));
    var pick = function (t) {
      return function () {
        setSettings({ noteType: t }); // remembered: every new note uses this type
        updateDock();
        startPlacing(t);
      };
    };
    var typeItems = {
      free: item(modes, "note", "o", "Note", "Pin it anywhere on the page", "place-note", pick("free")),
      el: item(modes, "el", "b", "Element", "Sticks to a button, image or block", "place-element", pick("el")),
      hl: item(modes, "hl", "y", "Text", "Highlight text, note next to it", "place-highlight", pick("hl")),
    };

    var menu = el("div", "menu");
    menu.setAttribute("role", "menu");
    menu.classList.add("desc");
    menu.append(el("div", "mh", "This page"));
    item(menu, "list", "", "All my notes", "See every note, on every site", "", function () {
      send({ type: "open-dashboard" });
    });
    item(menu, "copy", "", "Copy as text", "This page's notes, ready to paste", "", function () {
      var notes = page ? page.notes : [];
      if (settings.dev) return copyDev();
      var txt = notes
        .map(function (n, i) {
          return "#" + PN.pad(i + 1) + (n.done ? " [done]" : "") + " " + (n.hl ? "\u201c" + n.hl.text.trim() + "\u201d - " : "") + n.text;
        })
        .join("\n\n");
      copy((document.title || url) + "\n" + url + "\n\n" + txt, "Notes copied as text");
    });
    var wipe = item(menu, "trash", "r", "Delete all here", "Remove every note on this page", "", function () {
      removeAll();
    });
    wipe.classList.add("danger");
    item(menu, "gear", "", "Settings", "Toolbar, tips, language and more", "", function () {
      send({ type: "open-settings" });
    });
    menu.appendChild(el("hr"));
    // quick switches
    menu.append(el("div", "mh", "Show"));
    var mf = el("div", "mf");
    var sw = function (title, sub, get, set) {
      var l = el("label");
      var t = el("span");
      t.append(title, el("small", "", sub));
      var c = el("input", "sw");
      c.type = "checkbox";
      c.checked = get();
      c.onchange = function () {
        set(c.checked);
      };
      l.append(t, c);
      mf.append(l);
      return c;
    };
    var swNotes = sw("This page's notes", "Hide or show them here" + keyHint("toggle-notes"), function () {
      return !pageHidden();
    }, function (v) {
      setPageHidden(!v);
    });
    var swTips = sw("Tips", "Guides and messages - on all pages", function () {
      return tipsOn();
    }, function (v) {
      setSettings({ tips: v }); // global: every open page picks it up right away
      if (!v) hint.style.display = "none";
    });
    menu.append(mf);

    caret.onclick = function () {
      var open = !modes.classList.contains("open");
      closeMenus();
      modes.classList.toggle("open", open);
      caret.setAttribute("aria-expanded", String(open));
    };
    more.onclick = function () {
      swNotes.checked = !pageHidden();
      swTips.checked = tipsOn();
      var open = !menu.classList.contains("open");
      closeMenus();
      menu.classList.toggle("open", open);
    };
    var vr = function (c) {
      return el("span", "vr" + (c ? " " + c : ""));
    };
    root.append(brand, vr("n"), nav, vr("n"), split, status, vr(), fold, eye, more, close, modes, menu);
    return { fold: fold, eye: eye, root: root, cnt: cnt, menu: menu, modes: modes, caret: caret, pos: pos, prev: prev, next: next, help: help, stLabel: stLabel, add: add, typeItems: typeItems };
  }
  /** Saved toolbar spot: stuck to the left or right edge, at the height the user dropped it. */
  /** @returns {string} "l" or "r" */
  function dockSide() {
    var p = settings.dockPos;
    return p && p.side === "l" ? "l" : "r";
  }
  /** Put the toolbar at its saved side and height (kept inside the window). */
  function placeDock() {
    var p = settings.dockPos || {};
    var b = isFinite(p.b) ? p.b : 16;
    var side = dockSide();
    dock.root.style.bottom = Math.max(4, Math.min(b, innerHeight - 44)) + "px";
    dock.root.style.left = side === "l" ? "16px" : "auto";
    dock.root.style.right = side === "r" ? "16px" : "auto";
    dock.root.classList.toggle("left", side === "l");
    placePopovers();
  }
  /** Menus, guide card and messages open toward the free space (side + up/down). */
  function placePopovers() {
    var side = dockSide();
    var bottom = parseFloat(dock.root.style.bottom) || 16;
    var down = innerHeight - bottom < innerHeight / 2; // toolbar in the upper half → open downward
    var h = dock.root.offsetHeight || 32;
    dock.root.classList.toggle("down", down);
    [hint, toast].forEach(function (n) {
      n.style.left = side === "l" ? "16px" : "auto";
      n.style.right = side === "r" ? "16px" : "auto";
      if (down) {
        n.style.top = innerHeight - bottom + 10 + "px";
        n.style.bottom = "auto";
      } else {
        n.style.bottom = bottom + h + 10 + "px";
        n.style.top = "auto";
      }
    });
  }
  addEventListener("resize", function () {
    if (dock) placeDock();
  });
  /** Only adding a new note brings a closed toolbar back. */
  function reopenDock() {
    dockClosed = false;
    if (settings.dockHidden) setSettings({ dockHidden: false });
  }
  /** Small confirm dialog in the toolbar's style. */
  var cfm = null;
  /**
   * @param {string} title - heading
   * @param {string} text - body text
   * @param {string} okLabel - confirm button text
   * @param {Function} fn - called when confirmed
   */
  function askConfirm(title, text, okLabel, fn) {
    if (!cfm) {
      cfm = el("div", "cfm-bg");
      var box = el("div", "cfm");
      var ic = el("span", "ci2");
      ic.append(svg("trash"));
      cfm._t = el("b");
      cfm._p = el("p");
      var row = el("div", "row2");
      cfm._no = el("button", "no", "Cancel");
      cfm._yes = el("button", "yes");
      cfm._no.type = cfm._yes.type = "button";
      row.append(cfm._no, cfm._yes);
      box.append(ic, cfm._t, cfm._p, row);
      cfm.append(box);
      cfm.onclick = function (e) {
        if (e.target === cfm) cfm.classList.remove("on");
      };
      cfm._no.onclick = function () {
        cfm.classList.remove("on");
      };
      fixed.append(cfm);
    }
    cfm._t.textContent = title;
    cfm._p.textContent = text;
    cfm._yes.textContent = okLabel || "Delete";
    cfm._yes.onclick = function () {
      cfm.classList.remove("on");
      fn();
    };
    cfm.classList.add("on");
    cfm._no.focus();
  }
  /** Close the dock's menus. */
  function closeMenus() {
    dock.menu.classList.remove("open");
    dock.modes.classList.remove("open");
    dock.caret.setAttribute("aria-expanded", "false");
  }
  // menus close on any click outside the dock
  document.addEventListener(
    "pointerdown",
    function (e) {
      if (dock && e.target !== host) closeMenus(); // clicks inside our (closed) shadow root are retargeted to the host
    },
    true,
  );

  /** Press + NOTE: click = place mode (or highlight the selection) · drag = drop a note where you release. */
  /** @param {HTMLElement} btn - the add button */
  function dragToCreate(btn) {
    btn.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      e.preventDefault(); // keeps the page's text selection alive
      var sx = e.clientX;
      var sy = e.clientY;
      var ghost = null;
      btn.setPointerCapture(e.pointerId);
      var move = function (m) {
        if (curType() === "hl") return;
        if (!ghost && Math.abs(m.clientX - sx) + Math.abs(m.clientY - sy) < 6) return;
        if (!ghost) {
          ghost = el("div", "gxn-note ghost");
          ghost.style.background = PN.COLORS[(page ? page.notes.length : 0) % PN.COLORS.length];
          ghost.style.setProperty("--r", "-3deg");
          ghost.appendChild(el("div", "gxn-text", ""));
          ghost.firstChild.dataset.ph = "Drop me anywhere…";
          fixed.appendChild(ghost);
        }
        ghost.classList.toggle("doomed", trackZone("Release to cancel", m.clientX, m.clientY));
        ghost.style.left = m.clientX - 20 + "px";
        ghost.style.top = m.clientY - 20 + "px";
        var stick = m.shiftKey || curType() === "el";
        guides(m.clientX, m.clientY, stick);
        var t = stick ? under(m.clientX, m.clientY) : null;
        if (t) outline(t);
        else hl.style.display = "none";
      };
      var up = function (u) {
        btn.removeEventListener("pointermove", move);
        btn.removeEventListener("pointerup", up);
        btn.removeEventListener("pointercancel", up);
        if (!ghost) return placing ? stopPlacing() : startPlacing();
        ghost.remove();
        var onZone = trackZone("Release to cancel", u.clientX, u.clientY);
        hideZone();
        stopPlacing();
        if (u.type === "pointercancel" || onZone) return; // dropped on the cancel zone
        var stick = u.shiftKey || curType() === "el";
        var t = stick ? under(u.clientX, u.clientY) : null;
        if (curType() === "el" && !t) return say("Drop it on a button, image or block");
        create({ cx: u.clientX, cy: u.clientY, target: t });
      };
      btn.addEventListener("pointermove", move);
      btn.addEventListener("pointerup", up);
      btn.addEventListener("pointercancel", up);
    });
  }

  // ---------- note navigation (prev / next in the dock) ----------
  /** Notes sorted top-to-bottom, then left-to-right. @returns {Array<Object>} */
  function ordered() {
    return (page ? page.notes.slice() : []).sort(function (a, b) {
      var pa = place(a);
      var pb = place(b);
      return pa.y - pb.y || pa.x - pb.x;
    });
  }
  /** Focus the next (1) or previous (-1) note. @param {number} d - direction */
  function step(d) {
    var list = ordered();
    if (!list.length) return;
    navIdx = (navIdx + d + list.length) % list.length;
    focusNote(list[navIdx].id);
  }
  /** Show/hide the toolbar (setting off | auto | mini) and refresh its count and labels. */
  function updateDock() {
    var n = page ? page.notes.length : 0;
    var dm = settings.dock || "auto"; // off | auto | mini
    var closed = dockClosed || settings.dockHidden === true;
    var show = dm !== "off" && visible && (placing || (!closed && (dm === "mini" || n > 0 || dockWanted)));
    dock.root.style.display = show ? "flex" : "none";
    var folded = dm === "mini" ? !dockExpanded : !!settings.dockFolded;
    dock.root.classList.toggle("collapsed", folded && !placing);
    placeDock();
    dock.cnt.textContent = String(n);
    dock.cnt.classList.toggle("zero", !n);
    var open = page
      ? page.notes.filter(function (x) {
          return !x.done;
        }).length
      : 0;
    dock.root.firstChild.title = "Page Notes - " + n + " note" + (n === 1 ? "" : "s") + (n ? " (" + open + " open)" : "") + " - click to " + (settings.dockFolded ? "expand" : "minimize");
    dock.root.classList.toggle("placing", placing);
    dock.eye.style.display = dock.fold.style.display = n ? "" : "none"; // only useful once the page has notes
    fixed.classList.toggle("notips", !tipsOn()); // tips off: tools + actions only, no guidance text
    var ty = curType();
    dock.add.textContent = "";
    dock.add.append(svg(TYPES[ty][0]), TYPES[ty][1]); // label only - the shortcut is in the tooltip
    dock.add.title = (ty === "el" ? "Click, then click an element" : ty === "hl" ? "Click, then select text" : "Click, then click the page - or drag me onto the page") + keyHint("place-note");
    Object.keys(dock.typeItems).forEach(function (k) {
      dock.typeItems[k].setAttribute("aria-checked", String(k === ty));
      dock.typeItems[k].style.display = settings.dev && k !== "el" ? "none" : ""; // inspect mode: element only
    });
    dock.stLabel.textContent = mode === "el" ? "Pick an element" : mode === "hl" ? "Select some text" : "Click to place";
    dock.pos.textContent = "";
    if (n) dock.pos.append(el("b", "", navIdx > -1 ? PN.pad(navIdx + 1) : "--"), "/" + PN.pad(n));
    else dock.pos.textContent = "--";
    dock.pos.title = open + " open - " + (n - open) + " done";
    dock.prev.disabled = dock.next.disabled = n < 1;
  }

  // ---------- toast / visibility / focus / links ----------
  var toastT = 0;
  /** Message bar. Info messages follow "Show tips"; the Undo bar has its own setting. */
  /**
   * @param {string} text - message
   * @param {string} [action] - button label (e.g. "Undo")
   * @param {Function} [fn] - button handler
   */
  function say(text, action, fn) {
    if (action ? settings.undo === false : !tipsOn()) return;
    toast.textContent = "";
    var ic = el("span", "t-ic");
    ic.append(svg(action ? "trash" : /copied|stuck/i.test(text) ? "check" : "info"));
    toast.append(ic, el("span", "t-tx", text));
    var ms = action ? 6000 : 2200;
    if (action) {
      var b = el("button", "", action);
      b.type = "button";
      b.onclick = function () {
        toast.style.display = "none";
        fn();
      };
      toast.appendChild(b);
    }
    var bar = el("span", "t-bar");
    bar.style.animationDuration = ms + "ms";
    toast.appendChild(bar);
    toast.style.display = "flex";
    clearTimeout(toastT);
    toastT = setTimeout(function () {
      toast.style.display = "none";
    }, ms);
  }
  /** Inspect mode: every note on this site, grouped by route, with the CSS path of each picked element. */
  function copyDev() {
    chrome.storage.local.get(null, function (store) {
      var site = PN.host(url);
      var pages = PN.allPages(store).filter(function (p) {
        return PN.host(p.url) === site && p.url !== url;
      });
      if (page && page.notes.length) pages.unshift(page); // this page first, with unsaved edits
      copy(PN.devText(pages), "Notes of this site copied as text");
    });
  }
  /** Copy text to the clipboard and confirm with a message. @param {string} text @param {string} msg */
  function copy(text, msg) {
    navigator.clipboard.writeText(text).then(
      function () {
        say(msg);
      },
      function () {
        say("Couldn't copy — clipboard blocked on this site");
      },
    );
  }
  /** Notes show when "Show notes" is on and, in "only when I open Page Notes" mode, once revealed. */
  /** This page's notes hidden (per page, remembered in the page record). The toolbar stays. */
  var peek = false; // hidden page, but the user opened one of its notes: show for this visit only
  /** Whether this page's notes are hidden right now (unless peeking). @returns {boolean} */
  function pageHidden() {
    return !!(page && page.hide) && !peek;
  }
  /** Apply the per-page hide state to the notes layer, highlights and eye button. */
  function applyPageHide() {
    layer.style.display = pageHidden() ? "none" : "";
    applyHighlights();
    if (dock && dock.eye) {
      var off = pageHidden();
      dock.eye.classList.toggle("off", off);
      dock.eye.title = (off ? "Show this page's notes" : "Hide this page's notes") + keyHint("toggle-notes");
      dock.eye.textContent = "";
      dock.eye.append(svg(off ? "eye" : "eyeOn"));
    }
  }
  /** Hide or show this page's notes and save it in the page record. @param {boolean} v */
  function setPageHidden(v) {
    if (!page) return;
    peek = false;
    page.hide = v ? true : undefined;
    if (!v) delete page.hide;
    applyPageHide();
    flush();
  }
  /** Whether notes should show, from settings and reveal state. @returns {boolean} */
  function wantVisible() {
    return settings.visible !== false && (settings.notesWhen !== "click" || revealed);
  }
  /**
   * Show or hide the whole overlay.
   * @param {boolean} v - visible
   * @param {boolean} [fromStorage] - change came from settings (don't save it again)
   */
  function setVisible(v, fromStorage) {
    if (v && !fromStorage) revealed = true;
    visible = v;
    host.style.display = v ? "" : "none";
    if (!fromStorage) setSettings({ visible: v });
    if (v) scheduleReposition();
    else stopPlacing();
    applyHighlights();
    updateDock();
  }
  /** Scroll to a note, unfold it and flash it. @param {string} id - note id */
  function focusNote(id) {
    if (!page) return;
    var n = page.notes.find(function (x) {
      return x.id === id;
    });
    if (!n) return;
    if (!visible) setVisible(true);
    if (page.hide && !peek) {
      peek = true; // the stored "hidden" stays - leaving the page hides them again
      applyPageHide();
    }
    dockWanted = true;
    n.min = false;
    sync(n);
    if (nodes[n.id]) nodes[n.id].forced = true; // show it even if its element is hidden
    reposition();
    var p = place(n);
    navIdx = ordered().indexOf(n);
    updateDock();
    window.scrollTo({ top: Math.max(0, p.y - innerHeight * 0.3), left: Math.max(0, p.x - innerWidth / 2), behavior: "smooth" });
    var k = nodes[n.id];
    if (k) {
      k.root.classList.remove("pulse");
      void k.root.offsetWidth;
      k.root.classList.add("pulse");
      setTimeout(function () {
        k.root.classList.remove("pulse");
      }, 2400);
    }
  }
  /** Open the note another page asked for (storage "focus" entry, under 60 s old). */
  function checkFocus() {
    if (!alive()) return;
    chrome.storage.local.get("focus", function (r) {
      var f = r.focus;
      if (!f || f.url !== url || Date.now() - f.at > 60000) return;
      chrome.storage.local.remove("focus");
      later(f.id);
    });
  }
  /** Deep link: open the note named in #gx-note=<id>, then clean the URL. */
  function checkHash() {
    var m = /gx-note=([\w-]+)/.exec(location.hash);
    if (!m) return;
    history.replaceState(history.state, "", location.href.split("#")[0]);
    later(m[1]);
  }
  /** Focus a note after a short delay so late layouts settle. @param {string} id - note id */
  function later(id) {
    // give late layouts (fonts, images, SPA hydration) a moment
    setTimeout(function () {
      indexDirty = true;
      resolveHighlights();
      reposition();
      focusNote(id);
    }, 450);
  }
  addEventListener("hashchange", checkHash);

  // ---------- messages ----------
  // commands from background.js (shortcuts, context menu, popup); always replies with this page's state
  chrome.runtime.onMessage.addListener(function (m, _s, reply) {
    if (!m) return;
    if (m.type === "place") startPlacing(m.mode); // no mode = the type picked in the dock
    else if (m.type === "place-at-context" && settings.dev) startPlacing();
    else if (m.type === "place-at-context") {
      var sel = getSelection();
      if (!(sel && !sel.isCollapsed && String(sel).trim().length > 1 && highlightSelection(sel))) {
        var c = ctxPoint || { x: innerWidth / 2, y: innerHeight / 3, sx: scrollX, sy: scrollY, target: null };
        dockWanted = true;
        create({ cx: c.x + c.sx - scrollX, cy: c.y + c.sy - scrollY });
      }
    } else if (m.type === "toggle") {
      // Alt+Shift+H: this page only
      if (!visible) setVisible(true);
      else if (page && page.notes.length) {
        setPageHidden(!pageHidden());
        say(pageHidden() ? "This page's notes hidden" + (KEYS["toggle-notes"] ? " - " + KEYS["toggle-notes"] + " shows them" : "") : "This page's notes shown");
      }
    } else if (m.type === "focus") {
      revealed = true;
      focusNote(m.id);
    } else if (m.type === "reveal") {
      // the popup was opened on this tab
      if (!revealed && settings.visible !== false) {
        revealed = true;
        setVisible(true, true);
      }
    }
    reply({ ok: true, url: url, count: page ? page.notes.length : 0, visible: visible });
  });

  // ---------- keep up with the page ----------
  addEventListener("resize", function () {
    scheduleReposition();
  });
  addEventListener("load", function () {
    scheduleReposition(true);
  });
  if (document.fonts && document.fonts.ready)
    document.fonts.ready.then(function () {
      scheduleReposition();
    });
  // DOM changes: follow anchors, re-attach our host if a site removed it, tear down if orphaned
  var mo = new MutationObserver(function (list) {
    if (!alive()) return teardown();
    if (!host.isConnected) document.documentElement.appendChild(host);
    var content = list.some(function (r) {
      return r.type === "childList" || r.type === "characterData";
    });
    scheduleReposition(content);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["style", "class", "hidden", "open"] });
  if (window.ResizeObserver && document.body)
    new ResizeObserver(function () {
      scheduleReposition();
    }).observe(document.body);
  addEventListener("pagehide", flush);

  // SPA navigation + layout changes nothing told us about (CSS transitions, hover menus…)
  var tick = setInterval(function () {
    if (!alive()) return teardown();
    var now = PN.normUrl(location.href);
    if (now === url) {
      if (visible && page && page.notes.length && !document.hidden) reposition();
      return;
    }
    flush();
    stopPlacing();
    url = now;
    key = PN.keyFor(location.href);
    page = null;
    navIdx = -1;
    dockWanted = false;
    peek = false;
    renderAll();
    load();
  }, 800);

  /** The extension was reloaded/updated: this copy is disconnected - remove it cleanly. */
  function teardown() {
    if (teardown.done) return;
    teardown.done = true;
    try {
      mo.disconnect();
    } catch (e) {}
    clearInterval(tick);
    host.remove();
    var other = document.querySelector("gx-page-notes:not([data-gx-stale])"); // a newer copy owns the highlights now
    if (!other && window.CSS && CSS.highlights)
      PN.COLORS.forEach(function (c, i) {
        CSS.highlights.delete("gxpn-" + i);
      });
    window.__gxPageNotes = false;
  }

  load();
  setTimeout(count, 300);
})();
