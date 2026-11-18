/* Guetix Page Notes — service worker: shortcuts, context menu, badge, snapshots.
 *
 * Overview:
 * - Loads shared.js (the PN helper namespace) with importScripts.
 * - On install: builds the right-click menu and opens the welcome page (notes.html?welcome=1).
 * - Context menu + keyboard commands: forwarded to the content script (content.js) of the active tab.
 * - Fonts: reads the bundled toolbar fonts and sends them as base64 to the content script.
 * - Snapshots: captures the visible tab, crops a band around a note, stores it under PN.SHOT + id.
 * - Message listener: handles "count" (badge), "fonts", "shot", "open-dashboard",
 *   "open-settings" and "send-to-tab" from the content script, popup and dashboard.
 */
importScripts("shared.js");

/** Toolbar button: dropdown popup by default; resizable side panel when settings.sidePanel is on and the browser supports it. */
function usePanel() {
  if (!chrome.sidePanel || !chrome.sidePanel.setPanelBehavior) return;
  chrome.storage.local.get("settings", function (r) {
    var on = !!(r.settings && r.settings.sidePanel);
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: on })
      .then(function () {
        return chrome.action.setPopup({ popup: on ? "" : "popup.html" }); // a set popup wins over the panel
      })
      .catch(function () {});
  });
}
usePanel();
chrome.runtime.onStartup.addListener(usePanel); // setPopup is not kept across browser restarts
chrome.storage.onChanged.addListener(function (c) {
  if (c.settings) {
    usePanel();
    devMenus();
  }
});

/** "Copy all notes" and "Delete all notes" only show while inspect mode is on. */
function devMenus() {
  chrome.storage.local.get("settings", function (r) {
    var on = !!(r.settings && r.settings.dev);
    ["pn-copy", "pn-wipe"].forEach(function (id) {
      chrome.contextMenus.update(id, { visible: on }, function () {
        void chrome.runtime.lastError; // menu not created yet: onInstalled creates it with the right state
      });
    });
  });
}

/**
 * On install/update: (re)create the context menu entries; open the welcome page on first install.
 * @param {Object} details - install details (reason: "install" | "update" | ...)
 */
chrome.runtime.onInstalled.addListener(function (details) {
  usePanel();
  chrome.contextMenus.removeAll(function () {
    chrome.contextMenus.create({ id: "pn-add", title: "Pin a Page Note here", contexts: ["page", "link", "image", "video", "audio", "frame", "editable"], documentUrlPatterns: ["http://*/*", "https://*/*"] });
    chrome.contextMenus.create({ id: "pn-hl", title: "Highlight “%s” + note", contexts: ["selection"], documentUrlPatterns: ["http://*/*", "https://*/*"] });
    chrome.contextMenus.create({ id: "pn-list", title: "Open all my Page Notes", contexts: ["action", "page"] });
    chrome.contextMenus.create({ id: "pn-wipe", title: "Delete all notes (inspect mode)", contexts: ["page"], documentUrlPatterns: ["http://*/*", "https://*/*"] });
    chrome.contextMenus.create({ id: "pn-copy", title: "Copy all notes", contexts: ["page"], documentUrlPatterns: ["http://*/*", "https://*/*"] });
    devMenus();
  });
  if (details.reason === "install") chrome.tabs.create({ url: chrome.runtime.getURL("notes.html?welcome=1") });
});

/**
 * Talk to the page; inject the content script first if the tab predates the install.
 * @param {number} tabId - target tab
 * @param {Object} msg - message for the content script
 * @returns {Promise<*>} the content script reply, or null if the tab cannot be reached
 */
function send(tabId, msg) {
  return chrome.tabs.sendMessage(tabId, msg).catch(function () {
    return chrome.scripting
      .executeScript({ target: { tabId: tabId }, files: ["shared.js", "content.js"] })
      .then(function () {
        return chrome.tabs.sendMessage(tabId, msg);
      })
      .catch(function () {
        return null;
      });
  });
}

/**
 * Get the active tab of the current window.
 * @returns {Promise<Object>} the tab (or undefined)
 */
function activeTab() {
  return chrome.tabs.query({ active: true, currentWindow: true }).then(function (t) {
    return t[0];
  });
}

/** Open the notes dashboard (notes.html) in a new tab. */
function openDashboard() {
  chrome.tabs.create({ url: chrome.runtime.getURL("notes.html") });
}

/**
 * Copy every note from every site (current note set: inspect mode or normal) as Markdown, via the page.
 * @param {Object} tab - tab where the menu was opened
 */
function copyAll(tab) {
  if (!tab || tab.id == null) return;
  chrome.storage.local.get(null, function (store) {
    var dev = !!(store.settings && store.settings.dev);
    PN.setDev(dev);
    var pages = PN.allPages(store);
    var list = [];
    pages.forEach(function (p) {
      p.notes.forEach(function (n) {
        list.push({ page: p, note: n });
      });
    });
    chrome.scripting
      .executeScript({
        target: { tabId: tab.id },
        args: [dev ? PN.devText(pages) : PN.asText(list)], // inspect mode: same route + element-path format as the page menu's "Copy as text"
        func: function (text) {
          // service workers have no clipboard; the page does (execCommand fallback when the async API is refused)
          return navigator.clipboard.writeText(text).catch(function () {
            var t = document.createElement("textarea");
            t.value = text;
            t.style.cssText = "position:fixed;opacity:0";
            document.documentElement.appendChild(t);
            t.select();
            document.execCommand("copy");
            t.remove();
          });
        },
      })
      .catch(function () {});
  });
}

/**
 * Delete every inspect-mode note (all sites) and its snapshots, after a confirm in the page. Normal notes stay.
 * @param {Object} tab - tab where the menu was opened
 */
function wipeDev(tab) {
  if (!tab || tab.id == null) return;
  chrome.storage.local.get(null, function (store) {
    var dev = !!(store.settings && store.settings.dev);
    PN.setDev(true);
    var pages = PN.allPages(store);
    var keys = Object.keys(store).filter(function (k) {
      return k.indexOf(PN.PREFIX) === 0;
    });
    pages.forEach(function (p) {
      p.notes.forEach(function (n) {
        keys.push(PN.SHOT + n.id);
      });
    });
    var n = pages.reduce(function (a, p) {
      return a + p.notes.length;
    }, 0);
    PN.setDev(dev); // restore the active set for the rest of the worker
    chrome.scripting
      .executeScript({
        target: { tabId: tab.id },
        args: [n, pages.length],
        func: function (n, sites) {
          if (!n) return alert("No inspect-mode notes to delete."), false;
          return confirm("Delete all " + n + " inspect-mode notes on " + sites + " pages? This can't be undone.");
        },
      })
      .then(function (r) {
        if (r && r[0] && r[0].result) chrome.storage.local.remove(keys);
      })
      .catch(function () {});
  });
}

/**
 * Context menu click: open the dashboard, or ask the page to place a note at the clicked spot.
 * @param {Object} info - clicked menu item info
 * @param {Object} tab - tab where the menu was opened
 */
chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId === "pn-list") return openDashboard();
  if (info.menuItemId === "pn-copy") return copyAll(tab);
  if (info.menuItemId === "pn-wipe") return wipeDev(tab);
  if (tab && tab.id != null && PN.supported(tab.url)) send(tab.id, { type: "place-at-context" });
});

/**
 * Keyboard shortcut: toggle notes or start placing a note (free, on an element, or on a highlight).
 * @param {string} command - command name from manifest.json
 */
chrome.commands.onCommand.addListener(function (command) {
  activeTab().then(function (tab) {
    if (!tab || tab.id == null || !PN.supported(tab.url)) return;
    if (command === "toggle-notes") return send(tab.id, { type: "toggle" });
    var mode = command === "place-element" ? "el" : command === "place-highlight" ? "hl" : null;
    send(tab.id, mode ? { type: "place", mode: mode } : { type: "place" });
  });
});

// ---------- UI fonts for the in-page toolbar (sent as bytes: no web-accessible resources) ----------
var FONTS = [
  { family: "GXPN Pixel", file: "fonts/pixelify-sans.woff2", weight: "400 700" },
  { family: "GXPN Mono", file: "fonts/jetbrains-mono.woff2", weight: "100 800" },
];
var fontCache = null;
/**
 * Load the toolbar fonts once and cache them (the cache is reset on failure).
 * @returns {Promise<Array<Object>>} list of { family, weight, data } with base64 font data
 */
function fontsData() {
  if (fontCache) return fontCache;
  fontCache = Promise.all(
    FONTS.map(function (f) {
      return fetch(chrome.runtime.getURL(f.file))
        .then(function (r) {
          return r.arrayBuffer();
        })
        .then(function (buf) {
          var bytes = new Uint8Array(buf);
          var s = "";
          for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
          return { family: f.family, weight: f.weight, data: btoa(s) };
        });
    }),
  ).catch(function () {
    fontCache = null;
    return [];
  });
  return fontCache;
}

// ---------- snapshots ----------
/**
 * Convert a Blob to a base64 data URL.
 * @param {Blob} blob - image data
 * @returns {Promise<string>} data URL
 */
function toDataUrl(blob) {
  return blob.arrayBuffer().then(function (buf) {
    var bytes = new Uint8Array(buf);
    var s = "";
    for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return "data:" + blob.type + ";base64," + btoa(s);
  });
}

/**
 * Full-width view of the screen (a 16:6 band centered on the note, like the card preview), with the note visible on it.
 * @param {number} windowId - window of the tab to capture
 * @param {Object} m - viewport size and note position: { vw, vh, y }
 * @returns {Promise<string>} JPEG data URL (640px wide)
 */
function snapshot(windowId, m) {
  return chrome.tabs
    .captureVisibleTab(windowId, { format: "jpeg", quality: 82 })
    .then(function (url) {
      return fetch(url);
    })
    .then(function (r) {
      return r.blob();
    })
    .then(createImageBitmap)
    .then(function (bmp) {
      var k = bmp.width / Math.max(1, m.vw);
      var cw = m.vw; // the whole width of the screen, not a zoomed crop
      var ch = Math.min(m.vh, Math.round((m.vw * 6) / 16));
      var sx = 0;
      var sy = Math.max(0, Math.min(m.vh - ch, m.y - ch / 2));
      var W = 640;
      var H = Math.round((W * ch) / cw);
      var c = new OffscreenCanvas(W, H);
      var g = c.getContext("2d");
      g.drawImage(bmp, sx * k, sy * k, cw * k, ch * k, 0, 0, W, H);
      return c.convertToBlob({ type: "image/jpeg", quality: 0.74 });
    })
    .then(toDataUrl);
}

/**
 * Messages from the content script, popup and dashboard (badge count, fonts, snapshots, tab routing).
 * @param {Object} msg - message with a `type` field
 * @param {Object} sender - sender info (sender.tab for content scripts)
 * @param {Function} reply - sendResponse callback
 * @returns {boolean|undefined} true when the reply is sent asynchronously
 */
chrome.runtime.onMessage.addListener(function (msg, sender, reply) {
  if (!msg) return;
  var tab = sender.tab;
  if (msg.type === "count" && tab && tab.id != null) {
    var n = msg.n | 0;
    // the tab may already be closed/replaced (prerender, fast navigation) → ignore "No tab with id"
    var quiet = function () {};
    var tid = tab.id;
    Promise.resolve(chrome.action.setBadgeText({ tabId: tid, text: n ? String(n) : "" })).catch(quiet);
    Promise.resolve(chrome.action.setBadgeBackgroundColor({ tabId: tid, color: "#ff5b14" })).catch(quiet);
    if (chrome.action.setBadgeTextColor) Promise.resolve(chrome.action.setBadgeTextColor({ tabId: tid, color: "#ffffff" })).catch(quiet);
  }
  if (msg.type === "open-dashboard") openDashboard();
  if (msg.type === "fonts") {
    fontsData().then(function (fonts) {
      reply({ fonts: fonts });
    });
    return true; // async reply
  }
  if (msg.type === "open-settings") chrome.tabs.create({ url: chrome.runtime.getURL("notes.html#settings") });
  if (msg.type === "shot" && tab && typeof msg.id === "string") {
    snapshot(tab.windowId, msg)
      .then(function (data) {
        var o = {};
        o[PN.SHOT + msg.id] = data;
        return chrome.storage.local.set(o);
      })
      .then(
        function () {
          reply(true);
        },
        function () {
          reply(false);
        },
      );
    return true;
  }
  if (msg.type === "send-to-tab" && msg.tabId != null) {
    send(msg.tabId, msg.payload).then(reply);
    return true;
  }
});
