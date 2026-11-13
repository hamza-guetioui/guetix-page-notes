/* Guetix Page Notes — helpers shared by the content script, popup, dashboard and worker. */
/* eslint-disable no-var */
var PN = (function () {
  var PREFIX = "p:"; // page record:  p:<normalized url>
  var SHOT = "s:"; // note snapshot: s:<note id>  (JPEG data URL, kept apart so typing never rewrites images)
  // Same palette as the @guetix/page-notes package.
  var COLORS = ["#fde047", "#f9a8d4", "#86efac", "#7dd3fc"];
  var TRACKING = /^(utm_|fbclid$|gclid$|msclkid$|mc_cid$|mc_eid$|_ga$|ref_src$)/i;
  var URL_RE = /\bhttps?:\/\/[^\s<>"'`]+[^\s<>"'`.,;:!?)\]]/gi;

  /** One stable key per page: origin + path + meaningful query (no #hash, no tracking params). */
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
  function keyFor(href) {
    return PREFIX + normUrl(href);
  }
  function noteLink(pageUrl, id) {
    return pageUrl + "#gx-note=" + id;
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function supported(href) {
    return /^https?:\/\//i.test(href || "") && !/^https:\/\/(chrome\.google\.com\/webstore|chromewebstore\.google\.com|microsoftedge\.microsoft\.com\/addons)/i.test(href);
  }
  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  /** All saved pages, newest first. */
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
  function host(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch (e) {
      return url;
    }
  }

  /** URLs written inside a note. */
  function links(text) {
    var out = [];
    String(text || "").replace(URL_RE, function (u) {
      if (out.indexOf(u) < 0) out.push(u);
      return u;
    });
    return out;
  }

  /** Text → fragment with clickable links and the search term marked. Text nodes only, never innerHTML. */
  function rich(text, q) {
    var f = document.createDocumentFragment();
    var str = String(text || "");
    var i = 0;
    var m;
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

  /** Light validation for imported data — never trust a pasted file. */
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

  return { PREFIX: PREFIX, SHOT: SHOT, COLORS: COLORS, normUrl: normUrl, keyFor: keyFor, noteLink: noteLink, uid: uid, supported: supported, pad: pad, allPages: allPages, when: when, host: host, links: links, rich: rich, cleanPage: cleanPage };
})();
