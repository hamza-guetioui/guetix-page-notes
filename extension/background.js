/* Guetix Page Notes — service worker: shortcuts, context menu, badge, snapshots. */
importScripts("shared.js");

chrome.runtime.onInstalled.addListener(function (details) {
  chrome.contextMenus.removeAll(function () {
    chrome.contextMenus.create({ id: "pn-add", title: "Pin a Page Note here", contexts: ["page", "link", "image", "video", "audio", "frame", "editable"], documentUrlPatterns: ["http://*/*", "https://*/*"] });
    chrome.contextMenus.create({ id: "pn-hl", title: "Highlight “%s” + note", contexts: ["selection"], documentUrlPatterns: ["http://*/*", "https://*/*"] });
    chrome.contextMenus.create({ id: "pn-list", title: "Open all my Page Notes", contexts: ["action", "page"] });
  });
  if (details.reason === "install") chrome.tabs.create({ url: chrome.runtime.getURL("notes.html?welcome=1") });
});

/** Talk to the page; inject the content script first if the tab predates the install. */
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

function activeTab() {
  return chrome.tabs.query({ active: true, currentWindow: true }).then(function (t) {
    return t[0];
  });
}

function openDashboard() {
  chrome.tabs.create({ url: chrome.runtime.getURL("notes.html") });
}

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId === "pn-list") return openDashboard();
  if (tab && tab.id != null && PN.supported(tab.url)) send(tab.id, { type: "place-at-context" });
});

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
function toDataUrl(blob) {
  return blob.arrayBuffer().then(function (buf) {
    var bytes = new Uint8Array(buf);
    var s = "";
    for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return "data:" + blob.type + ";base64," + btoa(s);
  });
}

/** Full-width view of the screen (a 16:6 band centered on the note, like the card preview), with the note visible on it. */
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
