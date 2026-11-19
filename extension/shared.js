/* Guetix Page Notes — helpers shared by the content script, popup, dashboard and worker.
 *
 * Defines one global `PN` namespace (no modules: loaded by <script>, importScripts and executeScript).
 *
 * Storage keys (chrome.storage.local):
 * - p:<normalized url> → page record { url, title, favicon, notes: Array<note>, updatedAt, hide? }
 * - d:<normalized url> → same, for inspect-mode notes (kept apart from normal notes)
 * - s:<note id>        → JPEG data URL snapshot of that note (kept apart from the page record)
 *
 * Public API:
 * - PREFIX, SHOT, COLORS  key prefixes and note color palette
 * - normUrl, keyFor       stable page URL and its storage key
 * - noteLink, uid         deep link to one note, new note id
 * - supported             can notes run on this URL?
 * - allPages              all saved page records, newest first
 * - when, host, pad       display helpers (relative time, hostname, 2-digit pad)
 * - links, rich           URLs in a note; safe rich text fragment
 * - cleanPage             validate imported page data
 * PN.lang may be set by i18n.js to localize `when`.
 */
/* eslint-disable no-var */
var PN = (function () {
  var PREFIX = "p:"; // page record:  p:<normalized url>  ("d:" while inspect mode is on, see setDev)
  var SHOT = "s:"; // note snapshot: s:<note id>  (JPEG data URL, kept apart so typing never rewrites images)
  // Same palette as the @guetix/page-notes package.
  var COLORS = ["#fde047", "#f9a8d4", "#86efac", "#7dd3fc"];
  var TRACKING = /^(utm_|fbclid$|gclid$|msclkid$|mc_cid$|mc_eid$|_ga$|ref_src$)/i;
  var URL_RE = /\bhttps?:\/\/[^\s<>"'`]+[^\s<>"'`.,;:!?)\]]/gi;

  /**
   * One stable key per page: origin + path + meaningful query (no #hash, no tracking params).
   * @param {string} href - any page URL
   * @returns {string} normalized URL (the input as-is if it is not a valid URL)
   */
  function normUrl(href) {
    try {
      var u = new URL(href);
      u.hash = "";
      Array.from(u.searchParams.keys()).forEach(function (k) {
        if (TRACKING.test(k)) u.searchParams.delete(k);
      });
      var path = u.pathname.replace(/\/+$/, "") || "/";
      var q = u.searchParams.toString();
      return u.origin + path + (q ? "?" + q : "");
    } catch (e) {
      return String(href);
    }
  }
  /**
   * Storage key of a page record.
   * @param {string} href - page URL
   * @returns {string} "p:" + normalized URL
   */
  function keyFor(href) {
    return PREFIX + normUrl(href);
  }
  /**
   * Link that opens a page and focuses one note.
   * @param {string} pageUrl - page URL
   * @param {string} id - note id
   * @returns {string} URL with #gx-note=<id>
   */
  function noteLink(pageUrl, id) {
    return pageUrl + "#gx-note=" + id;
  }
  /**
   * New short unique id for a note.
   * @returns {string} id
   */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  /**
   * Can notes be used on this URL? Only http(s), and not on extension stores.
   * @param {string} href - page URL
   * @returns {boolean}
   */
  function supported(href) {
    return /^https?:\/\//i.test(href || "") && !/^https:\/\/(chrome\.google\.com\/webstore|chromewebstore\.google\.com|microsoftedge\.microsoft\.com\/addons)/i.test(href);
  }
  /**
   * Pad a number to two digits.
   * @param {number} n - number
   * @returns {string} e.g. "07"
   */
  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  /**
   * All saved pages, newest first.
   * @param {Object} store - full chrome.storage.local content
   * @returns {Array<Object>} page records that have at least one note
   */
  function allPages(store) {
    return Object.keys(store)
      .filter(function (k) {
        return k.indexOf(PREFIX) === 0 && store[k] && Array.isArray(store[k].notes) && store[k].notes.length;
      })
      .map(function (k) {
        return store[k];
      })
      .sort(function (a, b) {
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
  }

  /**
   * Short human time: relative for the last 7 days, else a date. Uses PN.lang when set.
   * @param {number} ts - timestamp in ms
   * @returns {string} e.g. "5m ago"
   */
  function when(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    var diff = (Date.now() - ts) / 1000;
    // localized pages (popup / settings load i18n.js and set PN.lang); the content script keeps English
    var L = typeof PN !== "undefined" && PN.lang && PN.lang !== "en" && typeof Intl !== "undefined" && Intl.RelativeTimeFormat ? PN.lang : null;
    if (L && diff < 86400 * 7) {
      var rtf = new Intl.RelativeTimeFormat(L, { numeric: "auto", style: "short" });
      if (diff < 60) return rtf.format(0, "second");
      if (diff < 3600) return rtf.format(-Math.floor(diff / 60), "minute");
      if (diff < 86400) return rtf.format(-Math.floor(diff / 3600), "hour");
      return rtf.format(-Math.floor(diff / 86400), "day");
    }
    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + "d ago";
    return d.toLocaleDateString(L || undefined, { day: "numeric", month: "short", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
  }
  /**
   * Hostname without "www.".
   * @param {string} url - URL
   * @returns {string} hostname (the input if it is not a valid URL)
   */
  function host(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch (e) {
      return url;
    }
  }

  /**
   * URLs written inside a note.
   * @param {string} text - note text
   * @returns {Array<string>} unique URLs in order
   */
  function links(text) {
    var out = [];
    String(text || "").replace(URL_RE, function (u) {
      if (out.indexOf(u) < 0) out.push(u);
      return u;
    });
    return out;
  }

  /**
   * Text → fragment with clickable links and the search term marked. Text nodes only, never innerHTML.
   * @param {string} text - note text
   * @param {string} q - lowercase search term to mark (optional)
   * @returns {DocumentFragment}
   */
  function rich(text, q) {
    var f = document.createDocumentFragment();
    var str = String(text || "");
    var i = 0;
    var m;
    /** Append plain text, wrapping each match of q in <mark>. */
    var mark = function (s) {
      if (!q) return f.append(s);
      var lower = s.toLowerCase();
      var k = 0;
      var j;
      while ((j = lower.indexOf(q, k)) > -1) {
        var mk = document.createElement("mark");
        mk.textContent = s.slice(j, j + q.length);
        f.append(s.slice(k, j), mk);
        k = j + q.length;
      }
      f.append(s.slice(k));
    };
    URL_RE.lastIndex = 0;
    while ((m = URL_RE.exec(str))) {
      mark(str.slice(i, m.index));
      var a = document.createElement("a");
      a.href = m[0];
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = host(m[0]) + (new URL(m[0]).pathname.length > 1 ? "/…" : "");
      a.title = m[0];
      f.append(a);
      i = m.index + m[0].length;
    }
    mark(str.slice(i));
    return f;
  }

  /**
   * Light validation for imported data — never trust a pasted file.
   * @param {Object} p - page record from an import file
   * @returns {Object|null} a clean page record, or null if invalid
   */
  function cleanPage(p) {
    if (!p || typeof p.url !== "string" || !supported(p.url) || !Array.isArray(p.notes)) return null;
    var num = function (v) {
      return isFinite(+v) ? +v : 0;
    };
    var notes = p.notes
      .filter(function (n) {
        return n && typeof n.id === "string" && /^[\w-]{1,40}$/.test(n.id);
      })
      .slice(0, 500)
      .map(function (n) {
        return {
          id: n.id,
          text: String(n.text || "").slice(0, 20000),
          color: COLORS.indexOf(n.color) > -1 ? n.color : COLORS[0],
          x: num(n.x),
          y: num(n.y),
          anchor: n.anchor && typeof n.anchor.sel === "string" ? { sel: n.anchor.sel.slice(0, 1000), fx: num(n.anchor.fx), dy: num(n.anchor.dy) } : null,
          hl: n.hl && typeof n.hl.text === "string" ? { text: n.hl.text.slice(0, 600), prefix: String(n.hl.prefix || "").slice(0, 64), suffix: String(n.hl.suffix || "").slice(0, 64) } : null,
          off: n.off ? { dx: num(n.off.dx), dy: num(n.off.dy) } : null,
          quote: String(n.quote || "").slice(0, 160),
          done: !!n.done,
          min: !!n.min,
          pri: n.pri === "urgent" ? "urgent" : "",
          w: n.w ? Math.max(160, Math.min(460, num(n.w))) : 0,
          h: n.h ? Math.max(110, Math.min(480, num(n.h))) : 0,
          createdAt: num(n.createdAt) || Date.now(),
          updatedAt: num(n.updatedAt) || Date.now(),
        };
      });
    return { hide: p.hide === true ? true : undefined, url: normUrl(p.url), title: String(p.title || "").slice(0, 300), favicon: typeof p.favicon === "string" && /^https?:/i.test(p.favicon) ? p.favicon : "", notes: notes, updatedAt: num(p.updatedAt) || Date.now() };
  }

  /**
   * Switch page records between normal ("p:") and inspect-mode ("d:") notes.
   * @param {boolean} on - settings.dev
   */
  function setDev(on) {
    PREFIX = on ? "d:" : "p:";
    api.PREFIX = PREFIX;
  }

  /**
   * Notes as readable Markdown, grouped by page.
   * @param {Array<Object>} list - entries of { page, note }
   * @returns {string}
   */
  function asText(list) {
    var byPage = {};
    var order = [];
    list.forEach(function (e) {
      if (!byPage[e.page.url]) {
        byPage[e.page.url] = { page: e.page, notes: [] };
        order.push(e.page.url);
      }
      byPage[e.page.url].notes.push(e.note);
    });
    var out = ["# Page Notes", ""];
    order.forEach(function (u) {
      var g = byPage[u];
      out.push("## " + (g.page.title || host(u)), u, "");
      g.notes.forEach(function (n) {
        var line = "- " + (n.done ? "[x] " : "[ ] ") + (n.pri === "urgent" ? "**URGENT** " : "") + (String(n.text || "").trim() || "(empty note)").replace(/\n/g, "\n  ");
        if (n.hl) line += "\n  > " + n.hl.text.replace(/\s+/g, " ").trim();
        out.push(line);
      });
      out.push("");
    });
    return out.join("\n");
  }

  /**
   * Inspect mode text: pages grouped by route, with the CSS path of each picked element.
   * @param {Array<Object>} pages - page records
   * @returns {string}
   */
  function devText(pages) {
    return pages
      .map(function (p) {
        var lines = p.notes.map(function (n) {
          var on = n.anchor && n.anchor.sel ? "note on " + n.anchor.sel + ": " : n.hl ? "note on \u201c" + n.hl.text.trim() + "\u201d: " : "";
          return "- " + (n.done ? "[done] " : "") + on + n.text;
        });
        return "## Route: " + p.url + "\n\n# Visual changes \u2014 " + (p.title || p.url) + "\n<" + p.url + ">\n\n## Comments\n" + lines.join("\n");
      })
      .join("\n\n---\n\n");
  }

  var api = { asText: asText, devText: devText, setDev: setDev, PREFIX: PREFIX, SHOT: SHOT, COLORS: COLORS, normUrl: normUrl, keyFor: keyFor, noteLink: noteLink, uid: uid, supported: supported, pad: pad, allPages: allPages, when: when, host: host, links: links, rich: rich, cleanPage: cleanPage };
  return api;
})();
