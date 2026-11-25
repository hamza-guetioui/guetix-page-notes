/* Guetix Page Notes — "All my notes": every note from every page, as visual cards.
 *
 * Main parts:
 *  - Routing between All notes, Guides (#guides) and Settings (#settings).
 *  - Helpers (DOM builder, toast, storage save, filters).
 *  - Note cards, the sticky-note editor, render() of the grid.
 *  - Controls: tabs, color / search filters, site + sort dropdowns (dropdown()), footer, settings nav.
 *  - Select mode: share, download as Markdown, bulk actions, delete confirm.
 *
 * Globals: PN (from shared.js: storage prefixes, colors, formatting helpers),
 * chrome.storage.local (all notes and snapshots; re-rendered on every change), chrome.tabs.
 */
(function () {
  /** Shortcut for document.getElementById. */
  var $ = function (id) {
    return document.getElementById(id);
  };
  var store = {}; // full chrome.storage.local snapshot
  // current filters: status ("all" | "open" | "done"), tags (ticked tag ids, all must match),
  // color, site host, sort ("new" | "old" | "site"), search text
  var state = { status: "all", tags: [], color: null, site: "", sort: "new", q: "" };
  var editing = null; // id of the note open in the editor (blocks re-render)
  var selecting = false; // select mode on/off
  var picked = {}; // note id -> true
  var lastList = []; // entries shown in the last render
  // filter dropdown options: [id, i18n key, dot color class]. Status = one choice, tags = any number (AND).
  var STATUSES = [
    ["all", "fltAny", "n"],
    ["open", "fltOpen", "o"],
    ["done", "fltDone", "g"],
  ];
  var TAGS = [
    ["urgent", "fltUrgent", "r"],
    ["hl", "fltHl", "y"],
    ["links", "fltLinks", "p"],
  ];

  // ---------- All notes | Settings (same page, #settings) ----------
  /** Shows the notes or settings view based on the URL hash. */
  function route() {
    var v = location.hash === "#settings" ? "settings" : location.hash === "#guides" ? "guides" : "notes";
    document.body.setAttribute("data-view", v);
    $("navNotes").setAttribute("aria-pressed", String(v === "notes"));
    $("navGuides").setAttribute("aria-pressed", String(v === "guides"));
    $("navSettings").setAttribute("aria-pressed", String(v === "settings"));
    document.title = (v === "settings" ? "Settings" : v === "guides" ? "Guides" : "All my notes") + " · Page Notes";
    if (v === "guides") guideKeys();
  }
  // real shortcuts (name -> "Ctrl+Shift+Y" / ""), for the empty-state steps
  var CMD = {};
  if (chrome.commands && chrome.commands.getAll)
    chrome.commands.getAll(function (list) {
      (list || []).forEach(function (c) {
        CMD[c.name] = c.shortcut || "";
      });
    });
  /** Fills the Guides shortcut list from the shortcuts the browser really assigned. */
  function guideKeys() {
    if (!chrome.commands || !chrome.commands.getAll) return;
    chrome.commands.getAll(function (list) {
      var box = $("gKeys");
      box.textContent = "";
      (list || []).forEach(function (c) {
        if (!c.description) return;
        var r = document.createElement("div");
        r.className = "kr";
        var k = document.createElement(c.shortcut ? "kbd" : "small");
        if (!c.shortcut) k.className = "none";
        k.textContent = c.shortcut || "Not set";
        var t = document.createElement("span");
        t.textContent = c.description;
        r.append(k, t);
        box.append(r);
      });
    });
  }
  addEventListener("hashchange", route);
  $("navNotes").onclick = function () {
    history.replaceState(null, "", location.pathname);
    route();
  };
  $("navSettings").onclick = function () {
    location.hash = "settings";
  };
  $("gKeysEdit").onclick = function (e) {
    e.preventDefault();
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  };
  $("navGuides").onclick = function () {
    location.hash = "guides";
  };
  route();
  $("verTop").textContent = "v" + chrome.runtime.getManifest().version;

  // ---------- helpers ----------
  /**
   * Creates an element with an optional class and text.
   * @param {string} tag - element tag name
   * @param {string} [cls] - class name
   * @param {string} [text] - text content
   * @returns {HTMLElement}
   */
  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  var toastT = 0;
  /**
   * Shows a short toast message.
   * @param {string} t - message text
   */
  function say(t) {
    var el = $("toast");
    el.textContent = t;
    el.classList.add("on");
    clearTimeout(toastT);
    toastT = setTimeout(function () {
      el.classList.remove("on");
    }, 1800);
  }
  /**
   * Note type name.
   * @param {Object} n - the note
   * @returns {string} "Highlight" | "Element" | "Free"
   */
  function kind(n) {
    return n.hl ? "Highlight" : n.anchor ? "Element" : "Free";
  }


  /**
   * Flat list of {page, note, i}.
   * @returns {Array<Object>}
   */
  function entries() {
    var out = [];
    PN.allPages(store).forEach(function (p) {
      p.notes.forEach(function (n, i) {
        out.push({ page: p, note: n, i: i });
      });
    });
    return out;
  }

  /**
   * Opens a page in a new tab; with a note, stores a focus request so the page scrolls to it.
   * @param {Object} page - the page
   * @param {Object} [note] - note to focus
   */
  function open(page, note) {
    var go = function () {
      chrome.tabs.create({ url: page.url });
    };
    if (note) chrome.storage.local.set({ focus: { url: page.url, id: note.id, at: Date.now() } }, go);
    else go();
  }
  /**
   * Saves a page to storage, or removes it when it has no notes left.
   * @param {Object} page - the page with its notes
   */
  function savePage(page) {
    var k = PN.PREFIX + page.url;
    if (page.notes.length) {
      page.updatedAt = Date.now();
      var o = {};
      o[k] = page;
      chrome.storage.local.set(o);
    } else chrome.storage.local.remove(k);
  }
  /**
   * Copies text to the clipboard and shows a toast.
   * @param {string} text - text to copy
   * @param {string} msg - toast message
   */
  function copy(text, msg) {
    navigator.clipboard.writeText(text).then(function () {
      say(msg);
    });
  }

  /**
   * Does a note carry a filter tag?
   * @param {Object} n - note
   * @param {string} t - "urgent" | "hl" | "links"
   * @returns {boolean}
   */
  function hasTag(n, t) {
    if (t === "urgent") return n.pri === "urgent";
    if (t === "hl") return !!n.hl;
    if (t === "links") return !!PN.links(n.text).length;
    return true;
  }
  /**
   * Checks an entry against the current filters and search text.
   * @param {Object} e - { page, note, i } entry
   * @param {string} q - lowercase search text
   * @param {Object} [f] - { status, tags } to test instead of the current ones (used for option counts)
   * @returns {boolean}
   */
  function matches(e, q, f) {
    var n = e.note;
    f = f || state;
    if (state.color && n.color !== state.color) return false;
    if (state.site && PN.host(e.page.url) !== state.site) return false;
    if (f.status === "open" && n.done) return false;
    if (f.status === "done" && !n.done) return false;
    for (var k = 0; k < f.tags.length; k++) if (!hasTag(n, f.tags[k])) return false;
    if (!q) return true;
    return (n.text + " " + (n.quote || "") + " " + (n.hl ? n.hl.text : "") + " " + e.page.title + " " + e.page.url).toLowerCase().indexOf(q) > -1;
  }

  // ---------- card ----------
  /**
   * Short site label for the card corner: "www.guetix.com" -> "guetix", "news.ycombinator.com" -> "ycombinator", "bbc.co.uk" -> "bbc".
   * @param {string} host
   * @returns {string}
   */
  function siteShort(host) {
    var parts = String(host || "").replace(/^www\./, "").split(".");
    if (parts.length < 2) return parts[0] || "";
    var i = parts.length - 2;
    if (parts.length > 2 && parts[i].length <= 3 && /^(co|com|org|net|gov|ac|edu)$/.test(parts[i])) i--; // bbc.co.uk
    var n = parts[i];
    return n.length > 14 ? n.slice(0, 13) + "…" : n;
  }
  // ---------- views: sticky (default) · preview · timeline (board: code kept, button hidden) ----------
  // to bring the board back: add "board" here and drop `hidden` from its switcher button in notes.html
  var VIEWS = ["sticky", "preview", "timeline"];
  var VCLS = { sticky: "vk", preview: "vg", timeline: "vh", board: "vb" };
  state.view = "sticky";
  var dragId = null; // id of the note being dragged on the board
  /**
   * Translated UI label (i18n.js), falling back to the key.
   * @param {string} k - i18n key
   * @returns {string}
   */
  function tr(k) {
    return PN.t ? PN.t(k) : k;
  }
  // action icons (static markup only)
  var AI = {
    "a-open": '<path d="M7 3H4.5A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13h7a1.5 1.5 0 0 0 1.5-1.5V9M10 3h3v3M13 3 7.5 8.5"/>',
    "a-done": '<circle cx="8" cy="8" r="5.5"/><path d="m5.7 8.1 1.6 1.6 3-3.3"/>',
    "a-reopen": '<path d="M3 8a5 5 0 1 0 1.6-3.7L3 5.8M3 3v2.8h2.8"/>',
    "a-link": '<path d="M6.7 8.8a3 3 0 0 0 4.5.3l1.8-1.8a3 3 0 0 0-4.2-4.2l-1 1M9.3 7.2a3 3 0 0 0-4.5-.3L3 8.7a3 3 0 0 0 4.2 4.2l1-1"/>',
    "a-edit": '<path d="M8.5 13h4.5M11 2.6a1.7 1.7 0 0 1 2.4 2.4L6 12.4l-3 .7.7-3z"/>',
    "a-wrap": '<path d="M2.5 4h11M2.5 8h8.5a2 2 0 0 1 0 4H8.5M10 10.5 8.5 12l1.5 1.5M2.5 12h3"/>',
    "a-nowrap": '<path d="M2.5 4h11M2.5 8h11M11 5.8 13.5 8 11 10.2M2.5 12h6"/>',
    "a-del": '<path d="M2.8 4.5h10.4M6.2 4.5V3.3c0-.4.4-.8.8-.8h2c.4 0 .8.4.8.8v1.2M4.2 4.5l.6 8a1 1 0 0 0 1 1h4.4a1 1 0 0 0 1-1l.6-8M6.8 7v3.8M9.2 7v3.8"/>',
  };
  /**
   * Round site icon: the favicon, or the first letter of the site when there is none.
   * @param {Object} p - the page
   * @returns {HTMLElement}
   */
  function fav(p) {
    var letter = (siteShort(PN.host(p.url)) || "?").charAt(0).toUpperCase();
    var f = h("span", "fav");
    if (!p.favicon) {
      f.textContent = letter;
      return f;
    }
    var im = h("img");
    im.alt = "";
    im.src = p.favicon;
    im.onerror = function () {
      im.remove();
      f.textContent = letter;
    };
    f.append(im);
    return f;
  }
  /**
   * Adds the status / urgent / highlight pills of a note to a box.
   * @param {Object} n - the note
   * @param {HTMLElement} box - where to add them
   * @param {boolean} [noStatus] - skip the Open / Done pill (board columns already say it)
   */
  function pills(n, box, noStatus) {
    if (n.pri === "urgent") box.append(h("span", "npill np-r", tr("urgent")));
    if (!noStatus) box.append(h("span", "npill " + (n.done ? "np-g" : "np-o"), tr(n.done ? "done" : "open")));
    if (n.hl) box.append(h("span", "npill np-y", tr("hl")));
  }
  /**
   * Status dropdown pill (Open / Urgent / Done) for the preview and sticky cards.
   * @param {Object} p - the page
   * @param {Object} n - the note
   * @returns {HTMLButtonElement}
   */
  function statusBtn(p, n) {
    var cur = statusOf(n);
    var st = h("button", "vst np-" + cur[2]);
    st.type = "button";
    st.setAttribute("aria-haspopup", "menu");
    st.setAttribute("aria-expanded", "false");
    st.setAttribute("aria-label", tr("fltStatus") + ": " + tr(cur[1]));
    st.append(h("span", "", tr(cur[1])));
    st.insertAdjacentHTML("beforeend", '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 6.5 3.5 3.5 3.5-3.5"/></svg>');
    st.onclick = function () {
      popMenu(
        st,
        STATUS.map(function (s) {
          return { label: tr(s[1]), icon: '<circle cx="8" cy="8" r="3.5"/>', cls: "so-" + s[2], checked: s === cur, fn: function () {
            if (s === cur) return;
            n.done = s[0] === "done";
            if (!n.done) n.pri = s[0] === "urgent" ? "urgent" : "";
            savePage(p); // keeps the date → the list order stays the same
          } };
        }),
        tr("fltStatus"),
      );
    };
    return st;
  }
  /**
   * Page title link that opens the page at the note.
   * @param {Object} e - { page, note, i } entry
   * @param {string} cls - class name
   * @returns {HTMLElement}
   */
  function pageLink(e, cls) {
    var a = h("a", cls, e.page.title || PN.host(e.page.url));
    a.href = PN.noteLink(e.page.url, e.note.id);
    a.title = e.page.url;
    a.onclick = function (ev) {
      ev.preventDefault();
      open(e.page, e.note);
    };
    return a;
  }
  /**
   * Card shell shared by every view: note colour, done / urgent state, select checkbox + select-mode click.
   * @param {Object} e - { page, note, i } entry
   * @returns {HTMLElement}
   */
  function shell(e) {
    var n = e.note;
    var c = h("article", "nc");
    c.style.setProperty("--c", n.color);
    c.setAttribute("data-id", n.id);
    if (n.done) c.setAttribute("data-done", "");
    if (n.pri === "urgent") c.classList.add("urgent");
    if (n.nowrap) c.classList.add("nowrap");
    var pk = h("span", "pick");
    pk.setAttribute("role", "checkbox");
    pk.setAttribute("aria-checked", String(!!picked[n.id]));
    pk.title = "Select";
    c.appendChild(pk);
    if (picked[n.id]) c.classList.add("picked");
    // in select mode a click anywhere on the card toggles it
    c.addEventListener(
      "click",
      function (ev) {
        if (!selecting) return;
        ev.preventDefault();
        ev.stopPropagation();
        if (picked[n.id]) delete picked[n.id];
        else picked[n.id] = true;
        c.classList.toggle("picked", !!picked[n.id]);
        pk.setAttribute("aria-checked", String(!!picked[n.id]));
        updateShare();
      },
      true,
    );
    return c;
  }
  /**
   * Hover actions: open, done / reopen, copy link, edit, delete.
   * @param {HTMLElement} c - the card
   * @param {Object} e - { page, note, i } entry
   */
  function actions(c, e, drawer) {
    var acts = h("div", drawer ? "acts drawer" : "acts");
    var box = acts;
    if (drawer) {
      // drawer: a "…" button opens a row of actions above it, growing to the left (inert while closed: no tab stops)
      box = h("div", "dr");
      box.inert = true;
      var tog = h("button", "tog");
      tog.type = "button";
      tog.title = tr("vwMore");
      tog.setAttribute("aria-label", tr("vwMore"));
      tog.setAttribute("aria-expanded", "false");
      tog.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path class="x" d="m4.5 4.5 7 7m0-7-7 7"/><g class="d"><circle cx="3.5" cy="8" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="12.5" cy="8" r="1.2"/></g></svg>'; // static markup only
      tog.onclick = function () {
        drawerOpen(acts, !acts.classList.contains("open"));
      };
      acts.onkeydown = function (ev) {
        if (ev.key === "Escape" && acts.classList.contains("open")) {
          ev.stopPropagation();
          drawerOpen(acts, false);
          tog.focus();
        }
      };
      acts.append(box, tog);
    }
    noteActs(e).forEach(function (a) {
      if (drawer && (a.cls === "a-done" || a.cls === "a-reopen")) return; // status lives in the card's dropdown
      var b = h("button", a.cls);
      b.type = "button";
      if (drawer) b.dataset.tip = tr(a.key); // CSS tooltip
      else b.title = tr(a.key);
      b.setAttribute("aria-label", tr(a.key));
      b.insertAdjacentHTML("beforeend", '<svg viewBox="0 0 16 16" aria-hidden="true">' + AI[a.cls] + "</svg>"); // static markup only
      b.onclick = function () {
        a.fn(b);
      };
      box.appendChild(b);
    });
    c.appendChild(acts);
  }
  /**
   * Opens or closes a sticky card's action drawer; only one is open at a time.
   * @param {HTMLElement} acts - the .acts.drawer element
   * @param {boolean} on
   */
  function drawerOpen(acts, on) {
    if (on) document.querySelectorAll(".acts.open").forEach(function (o) {
      if (o !== acts) drawerOpen(o, false);
    });
    acts.classList.toggle("open", on);
    acts.querySelector(".dr").inert = !on;
    acts.querySelector(".tog").setAttribute("aria-expanded", String(on));
  }
  // a click outside an open drawer closes it
  document.addEventListener("pointerdown", function (ev) {
    document.querySelectorAll(".acts.open").forEach(function (o) {
      if (!o.contains(ev.target)) drawerOpen(o, false);
    });
  });
  /**
   * The note actions shared by the hover bar and the preview card's "…" menu.
   * @param {Object} e - { page, note, i } entry
   * @returns {Array<{key: string, cls: string, fn: function(HTMLElement=)}>} i18n key, icon (AI) key, action (gets the button)
   */
  function noteActs(e) {
    var p = e.page;
    var n = e.note;
    return [
      { key: "vwOpen", cls: "a-open", fn: function () {
        open(p, n);
      } },
      { key: n.done ? "vwReopen" : "vwDone", cls: n.done ? "a-reopen" : "a-done", fn: function () {
        n.done = !n.done; // status change keeps the date → the list order stays the same
        savePage(p);
        say(n.done ? "Marked as done" : "Reopened");
      } },
      { key: "vwCopy", cls: "a-link", fn: function (b) {
        navigator.clipboard.writeText(PN.noteLink(p.url, n.id)).then(
          function () {
            if (b) b.classList.add("ok");
            say("Link to this note copied");
            setTimeout(function () {
              if (b) b.classList.remove("ok");
            }, 1600);
          },
          function () {
            say("Couldn't copy - clipboard blocked");
          },
        );
      } },
      { key: n.nowrap ? "vwWrap" : "vwNoWrap", cls: n.nowrap ? "a-wrap" : "a-nowrap", fn: function () {
        n.nowrap = !n.nowrap; // long lines: wrap (default) or keep them and scroll sideways
        savePage(p);
      } },
      { key: "vwEdit", cls: "a-edit", fn: function () {
        openEditor(p, n);
      } },
      { key: "vwDel", cls: "a-del", fn: function () {
        askDelete(1, function () {
          p.notes = p.notes.filter(function (x) {
            return x.id !== n.id;
          });
          chrome.storage.local.remove(PN.SHOT + n.id);
          savePage(p);
          say("Note deleted");
        });
      } },
    ];
  }
  // status of a note: [value, i18n key, pill class]; Open/Urgent reopen it, Done keeps the urgent flag
  var STATUS = [["open", "open", "o"], ["urgent", "urgent", "r"], ["done", "done", "g"]];
  /**
   * @param {Object} n - note
   * @returns {Array} its STATUS row
   */
  function statusOf(n) {
    return STATUS[n.done ? 2 : n.pri === "urgent" ? 1 : 0];
  }
  var popEl = null; // the open popup menu (one at a time)
  /**
   * Closes the popup menu.
   * @param {boolean} [refocus] - move focus back to the button that opened it
   */
  function closePop(refocus) {
    if (!popEl) return;
    var a = popEl._anchor;
    popEl.remove();
    popEl = null;
    a.setAttribute("aria-expanded", "false");
    if (refocus) a.focus();
  }
  /**
   * Small popup menu under (or above) a button, fixed to the viewport so card overflow can't clip it.
   * Clicking the same button again closes it.
   * @param {HTMLElement} anchor - the button
   * @param {Array<{label: string, icon: string, fn: function, checked: (boolean|undefined), cls: (string|undefined), color: (string|undefined)}>} items
   *   icon = static SVG markup; checked set → radio item; cls = extra row class ("danger", "so-g"…);
   *   color set → the menu is a titled row of colour swatches instead (label = swatch name)
   * @param {string} label - menu name for screen readers
   * @param {boolean} [end] - align with the button's end edge instead of its start
   * @param {boolean} [up] - open above the button (below only when there is no room above)
   */
  function popMenu(anchor, items, label, end, up) {
    var same = popEl && popEl._anchor === anchor;
    closePop(false);
    if (same) return;
    var m = h("div", "ddmenu pop");
    m.setAttribute("role", "menu");
    m.setAttribute("aria-label", label);
    m._anchor = anchor;
    var sw = items.length && items[0].color;
    var box = m;
    if (sw) {
      m.classList.add("swpop");
      box = h("div", "sws");
      m.append(h("div", "fh", label), box);
    }
    items.forEach(function (it) {
      if (sw) {
        var s = h("div", "sw");
        s.setAttribute("role", "menuitemradio");
        s.setAttribute("aria-checked", String(!!it.checked));
        s.setAttribute("aria-label", it.label);
        s.title = it.label;
        s.tabIndex = -1;
        s.style.setProperty("--c", it.color);
        s.onclick = function () {
          closePop(true);
          it.fn();
        };
        return box.append(s);
      }
      var r = h("div", "ddo" + (it.cls ? " " + it.cls : ""));
      r.setAttribute("role", it.checked == null ? "menuitem" : "menuitemradio");
      if (it.checked != null) r.setAttribute("aria-checked", String(it.checked));
      r.tabIndex = -1;
      var g = h("span", "ddg");
      g.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true">' + it.icon + "</svg>"; // static markup only
      r.append(g, h("span", "fl", it.label));
      if (it.checked != null) r.insertAdjacentHTML("beforeend", DD_CHECK);
      r.onclick = function () {
        closePop(true);
        it.fn();
      };
      m.append(r);
    });
    m.onkeydown = function (ev) {
      var rs = Array.prototype.slice.call(box.children);
      var i = rs.indexOf(document.activeElement);
      if (ev.key === "Escape") i = -2;
      else if (ev.key === "Tab") return closePop(false);
      else if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        if (i > -1) rs[i].click();
        return;
      }
      else if (ev.key === (sw ? "ArrowRight" : "ArrowDown")) i = (i + 1) % rs.length;
      else if (ev.key === (sw ? "ArrowLeft" : "ArrowUp")) i = (i - 1 + rs.length) % rs.length;
      else if (ev.key === "Home") i = 0;
      else if (ev.key === "End") i = rs.length - 1;
      else return;
      ev.preventDefault();
      ev.stopPropagation();
      if (i === -2) closePop(true);
      else rs[i].focus();
    };
    document.body.append(m);
    popEl = m;
    anchor.setAttribute("aria-expanded", "true");
    var b = anchor.getBoundingClientRect();
    var right = !!end !== (getComputedStyle(anchor).direction === "rtl");
    var x = right ? b.right - m.offsetWidth : b.left;
    var above = b.top - m.offsetHeight - 6;
    var y = b.bottom + 6;
    // inside a card: open over the card (towards its larger side) and keep within its edges
    var card = anchor.closest(".nc");
    if (card) {
      var cb = card.getBoundingClientRect();
      up = b.top - cb.top > cb.bottom - b.bottom;
      x = Math.max(cb.left + 6, Math.min(cb.right - m.offsetWidth - 6, x));
    }
    if (up ? above >= 8 : y + m.offsetHeight > innerHeight - 8) y = above; // up, or no room below → open upwards
    m.style.left = Math.max(8, Math.min(innerWidth - m.offsetWidth - 8, x)) + "px";
    m.style.top = Math.max(8, y) + "px";
    (box.querySelector("[aria-checked=true]") || box.firstChild).focus();
  }
  document.addEventListener("mousedown", function (ev) {
    if (popEl && !popEl.contains(ev.target) && !popEl._anchor.contains(ev.target)) closePop(false);
  });
  addEventListener("resize", function () {
    closePop(false);
  });
  document.addEventListener(
    "scroll",
    function (ev) {
      if (popEl && !popEl.contains(ev.target)) closePop(false);
    },
    true,
  );
  /**
   * Path of a page for the preview card link: "/docs/intro?x=1" (decoded), "/" for a home page.
   * @param {string} url
   * @returns {string}
   */
  function pagePath(url) {
    try {
      var u = new URL(url);
      var s = u.pathname + u.search;
      try {
        return decodeURI(s);
      } catch (x) {
        return s; // malformed %-escape: show it raw
      }
    } catch (x) {
      return url;
    }
  }
  /**
   * Note text element. An empty note shows a soft placeholder instead.
   * @param {Object} n - note
   * @param {boolean} [tap] - the text is click-to-edit: the placeholder says so
   * @returns {HTMLElement}
   */
  function textEl(n, tap) {
    var t = n.text.trim();
    return h("div", t ? "t" : "t ph", t || tr(tap ? "emptyTap" : "emptyNote"));
  }
  /**
   * Top row of a sticky card: site icon + domain · time.
   * @param {Object} e - { page, note, i } entry
   * @returns {HTMLElement}
   */
  function topRow(e) {
    var host = PN.host(e.page.url);
    var top = h("div", "ntop");
    var nm = h("span", "nm", host.replace(/^www\./, ""));
    nm.title = host;
    top.append(fav(e.page), nm, h("span", "k", PN.when(e.note.updatedAt || e.note.createdAt)));
    return top;
  }
  /**
   * Grid card for the sticky and preview views. Preview: site + "…" menu, snapshot (opens the page),
   * page path, scrolling text, status dropdown + time.
   * @param {Object} e - { page, note, i } entry
   * @param {Object} shots - storage snapshot holding the note screenshots (PN.SHOT + id)
   * @param {string} view - "sticky" | "preview"
   * @returns {HTMLElement}
   */
  function noteCard(e, shots, view) {
    var p = e.page;
    var n = e.note;
    var c = shell(e);
    var txt = textEl(n, true);
    if (view === "preview") {
      // where the note sits: the saved snapshot, else a drawn mini page with the note on it
      // a click anywhere on the shot opens the page; the path link inside it is the keyboard / screen-reader way
      var sh = h("div", "sh");
      sh.title = "Open the page at this note";
      sh.onclick = function (ev) {
        if (!ev.target.closest("a")) open(p, n);
      };
      var img = shots[PN.SHOT + n.id];
      if (img) {
        var im = h("img");
        im.alt = "Where this note sits on " + PN.host(p.url);
        im.loading = "lazy";
        im.src = img;
        // the whole shot is shown (contain); a blurred copy fills the bands it leaves empty
        var bl = h("img", "bl");
        bl.alt = "";
        bl.loading = "lazy";
        bl.src = img;
        sh.append(bl, im);
      } else {
        // a drawn page (text lines, % of the box) with the note on it, placed roughly like on the page
        [[16, 38], [27, 52], [68, 30], [79, 46]].forEach(function (x) {
          var ln = h("i");
          ln.style.top = x[0] + "%";
          ln.style.insetInlineEnd = x[1] + "%";
          sh.append(ln);
        });
        var b = h("b");
        b.style.top = 24 + (Math.abs(n.y || 0) % 30) + "%";
        b.style.insetInlineStart = 50 + (Math.abs(n.x || 0) % 30) + "%";
        sh.append(b);
      }
      // head: site domain · "…" menu
      var host = PN.host(p.url);
      var hd = h("div", "vhd");
      var dm = h("span", "dm");
      dm.title = host;
      dm.append(fav(p), h("span", "dmn", host));
      var more = h("button", "vmore");
      more.type = "button";
      more.title = tr("vwMore");
      more.setAttribute("aria-label", tr("vwMore"));
      more.setAttribute("aria-haspopup", "menu");
      more.setAttribute("aria-expanded", "false");
      more.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3.5" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="12.5" cy="8" r="1.3"/></svg>';
      more.onclick = function () {
        // status lives in the footer, so the menu skips done / reopen
        var items = noteActs(e)
          .filter(function (a) {
            return a.cls !== "a-done" && a.cls !== "a-reopen";
          })
          .map(function (a) {
            return { label: tr(a.key), icon: AI[a.cls], cls: a.cls === "a-del" ? "danger" : "", fn: function () {
              a.fn();
            } };
          });
        popMenu(more, items, tr("vwMore"), true);
      };
      hd.append(dm, more);
      // page path link in a box at the bottom of the shot (redirect icon slides in on hover)
      var pg = pageLink(e, "pgp");
      pg.textContent = "";
      pg.insertAdjacentHTML("beforeend", '<svg viewBox="0 0 16 16" aria-hidden="true">' + AI["a-link"] + "</svg>"); // static markup only
      pg.append(h("span", "", pagePath(p.url)));
      pg.insertAdjacentHTML("beforeend", '<svg class="go" viewBox="0 0 16 16" aria-hidden="true">' + AI["a-open"] + "</svg>");
      sh.append(pg);
      // footer: status dropdown · time
      var st = statusBtn(p, n);
      // colour: a swatch button opening a row of the note colours
      var cb = h("button", "vclr");
      cb.type = "button";
      cb.title = tr("vwColor");
      cb.setAttribute("aria-label", tr("vwColor"));
      cb.setAttribute("aria-haspopup", "menu");
      cb.setAttribute("aria-expanded", "false");
      cb.insertAdjacentHTML("beforeend", '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 6.5 3.5 3.5 3.5-3.5"/></svg>');
      cb.onclick = function () {
        popMenu(
          cb,
          PN.COLORS.map(function (col, k) {
            return { label: tr("clr" + k), color: col, checked: col === n.color, fn: function () {
              if (col === n.color) return;
              n.color = col;
              savePage(p); // keeps the date → the list order stays the same
              dropShot(n);
            } };
          }),
          tr("vwColor"),
          false,
          true,
        );
      };
      var ft = h("div", "vft");
      ft.append(st, cb);
      if (n.hl) ft.append(h("span", "npill np-y", tr("hl")));
      ft.append(h("span", "k", PN.when(n.updatedAt || n.createdAt)));
      inlineEdit(txt, p, n);
      c.append(hd, sh, txt, ft);
      return c;
    }
    var bot = h("div", "bot");
    bot.append(statusBtn(p, n));
    if (n.hl) bot.append(h("span", "npill np-y", tr("hl")));
    // page link in a box under the header: link icon + the link itself (domain + path) + redirect icon
    var pb = pageLink(e, "pgb");
    pb.textContent = "";
    pb.insertAdjacentHTML("beforeend", '<span class="pgi" aria-hidden="true"><svg viewBox="0 0 16 16">' + AI["a-link"] + "</svg></span>"); // static markup only
    var path = pagePath(p.url);
    var pn = h("span", "pgn");
    pn.append(h("b", "", PN.host(p.url).replace(/^www\./, "")), path === "/" ? "" : path);
    pb.append(pn);
    if (p.title) pb.title = p.title + "\n" + p.url;
    pb.insertAdjacentHTML("beforeend", '<svg class="go" viewBox="0 0 16 16" aria-hidden="true">' + AI["a-open"] + "</svg>");
    inlineEdit(txt, p, n);
    c.append(topRow(e), pb, txt, bot);
    actions(bot, e, true);
    return c;
  }
  /**
   * Timeline row: clock time in the gutter, colour edge, text (click to edit) over site · page link,
   * status dropdown + action drawer on the right.
   * @param {Object} e - { page, note, i } entry
   * @returns {HTMLElement}
   */
  function rowCard(e) {
    var p = e.page;
    var n = e.note;
    var c = shell(e);
    var ts = n.createdAt || 0;
    var tm = h("time", "tm", new Date(ts).toLocaleTimeString(PN.lang || undefined, { hour: "numeric", minute: "2-digit" }));
    tm.dateTime = new Date(ts).toISOString();
    var txt = textEl(n, true);
    inlineEdit(txt, p, n);
    var s = h("div", "s");
    var host = PN.host(p.url);
    var nm = h("b", "nm", host.replace(/^www\./, ""));
    nm.title = host;
    s.append(fav(p), nm, h("span", "sep", "/"), pageLink(e, "pgt"), h("span", "sep", "·"), h("span", "k", PN.when(n.updatedAt || n.createdAt)));
    var r = h("div", "r");
    r.append(statusBtn(p, n));
    if (n.hl) r.append(h("span", "npill np-y", tr("hl")));
    actions(r, e, true);
    c.append(tm, txt, s, r);
    return c;
  }
  /**
   * Day heading for the timeline: Today, Yesterday, a weekday this week, else the date (UI language).
   * @param {number} ts - timestamp
   * @returns {string}
   */
  function dayLabel(ts) {
    var d = new Date(ts || 0);
    var t0 = new Date();
    t0.setHours(0, 0, 0, 0);
    var d0 = new Date(d);
    d0.setHours(0, 0, 0, 0);
    var diff = Math.round((t0 - d0) / 864e5);
    if (diff === 0) return tr("vwToday");
    if (diff === 1) return tr("vwYesterday");
    var o = diff > 1 && diff < 7 ? { weekday: "long" } : { weekday: "short", day: "numeric", month: "long" };
    if (d.getFullYear() !== t0.getFullYear()) o.year = "numeric";
    try {
      return d.toLocaleDateString(PN.lang || undefined, o);
    } catch {
      return d.toDateString();
    }
  }
  /**
   * Timeline: notes grouped by day (by site when sorted by site), in the current sort order.
   * @param {HTMLElement} grid - container
   * @param {Array<Object>} list - sorted entries
   */
  function timeline(grid, list) {
    var last = null;
    list.forEach(function (e) {
      var ts = e.note.createdAt || 0;
      var key = state.sort === "site" ? PN.host(e.page.url) : new Date(ts).toDateString();
      if (key !== last) {
        grid.appendChild(h("div", "day", state.sort === "site" ? key : dayLabel(ts)));
        last = key;
      }
      grid.appendChild(rowCard(e));
    });
  }
  /**
   * Board column of a note.
   * @param {Object} n - the note
   * @returns {string} "open" | "urgent" | "done"
   */
  function colOf(n) {
    return n.done ? "done" : n.pri === "urgent" ? "urgent" : "open";
  }
  /**
   * Moves a note to a board column: changes its status with the same save path as the done / urgent toggles.
   * @param {string} id - note id
   * @param {string} to - "open" | "urgent" | "done"
   */
  function moveTo(id, to) {
    var e = lastList.filter(function (x) {
      return x.note.id === id;
    })[0];
    if (!e || colOf(e.note) === to) return;
    var n = e.note;
    if (to === "done") n.done = true;
    else {
      n.done = false;
      n.pri = to === "urgent" ? "urgent" : "";
    }
    savePage(e.page);
    say(to === "done" ? "Marked as done" : to === "urgent" ? "Marked as urgent" : "Reopened");
  }
  /**
   * Board card: coloured top edge, text, site + time; draggable between columns.
   * @param {Object} e - { page, note, i } entry
   * @returns {HTMLElement}
   */
  function boardCard(e) {
    var n = e.note;
    var c = shell(e);
    c.draggable = true;
    c.addEventListener("dragstart", function (ev) {
      dragId = n.id;
      ev.dataTransfer.effectAllowed = "move";
      ev.dataTransfer.setData("text/plain", n.id);
      c.classList.add("drag");
    });
    c.addEventListener("dragend", function () {
      dragId = null;
      c.classList.remove("drag");
    });
    var host = PN.host(e.page.url);
    var s = h("div", "s");
    var nm = h("span", "nm", siteShort(host));
    nm.title = host;
    s.append(fav(e.page), nm, h("span", "k", PN.when(n.updatedAt || n.createdAt)));
    c.append(textEl(n));
    if (n.hl || (n.done && n.pri === "urgent")) {
      var pl = h("div", "bot");
      pills(n, pl, true);
      c.append(pl);
    }
    c.append(s);
    actions(c, e);
    return c;
  }
  /**
   * Board: Open · Urgent · Done columns with counts; drop a card on a column to change its status.
   * @param {HTMLElement} grid - container
   * @param {Array<Object>} list - sorted entries
   */
  function board(grid, list) {
    [["open", "var(--orange)"], ["urgent", "var(--red)"], ["done", "var(--g)"]].forEach(function (cd) {
      var items = list.filter(function (e) {
        return colOf(e.note) === cd[0];
      });
      var col = h("section", "col");
      col.setAttribute("data-col", cd[0]);
      col.setAttribute("aria-label", tr(cd[0]));
      var hd = h("header");
      var dot = h("i");
      dot.style.background = cd[1];
      hd.append(dot, tr(cd[0]), h("span", "", String(items.length)));
      var lst = h("div", "lst");
      items.forEach(function (e) {
        lst.appendChild(boardCard(e));
      });
      if (!items.length) lst.appendChild(h("div", "drop", tr("vwDrop")));
      col.append(hd, lst);
      col.addEventListener("dragover", function (ev) {
        if (!dragId) return;
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "move";
        col.classList.add("over");
      });
      col.addEventListener("dragleave", function (ev) {
        if (!col.contains(ev.relatedTarget)) col.classList.remove("over");
      });
      col.addEventListener("drop", function (ev) {
        ev.preventDefault();
        col.classList.remove("over");
        var id = dragId || ev.dataTransfer.getData("text/plain");
        dragId = null;
        if (id) moveTo(id, cd[0]);
      });
      grid.appendChild(col);
    });
  }

  // ---------- editor: the note as a sticky note, like on the page ----------
  var ed = null; // editor draft: { p, n, color, done, urgent }
  /**
   * Opens the editor for a note.
   * @param {Object} p - the page
   * @param {Object} n - the note
   */
  /**
   * Preview cards: click (or Enter on) the note text to edit it in place.
   * Blur or Ctrl+Enter saves, Esc cancels.
   * @param {HTMLElement} txt - the .t text element
   * @param {object} p - page
   * @param {object} n - note
   */
  function inlineEdit(txt, p, n) {
    txt.tabIndex = 0;
    txt.setAttribute("role", "button");
    txt.title = tr("vwEdit");
    txt.onkeydown = function (ev) {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        txt.onclick();
      }
    };
    txt.onclick = function (ev) {
      if (selecting || editing || String(getSelection()).length) return; // let people select text to copy it
      // caret where the user clicked (keyboard: at the start); keep the scroll position
      var at = 0;
      var hit = ev && ev.clientX != null && document.caretRangeFromPoint && document.caretRangeFromPoint(ev.clientX, ev.clientY);
      if (txt.classList.contains("ph")) at = 0;
      else if (hit && hit.startContainer.parentNode === txt) at = Math.max(0, n.text.indexOf(txt.textContent)) + hit.startOffset;
      var top = txt.scrollTop;
      var ta = h("textarea", "t te");
      ta.value = n.text;
      ta.setAttribute("aria-label", tr("vwEdit"));
      var done = false;
      var down = false; // blur came from a mouse press → let that click land before the grid redraws
      function pd() {
        down = true;
      }
      document.addEventListener("pointerdown", pd, true);
      function finish(save) {
        if (done) return;
        done = true;
        document.removeEventListener("pointerdown", pd, true);
        var text = ta.value.replace(/\s+$/, "");
        if (save && text !== n.text) {
          n.text = text;
          n.updatedAt = Date.now();
          savePage(p);
          say("Saved");
        }
        txt.textContent = n.text.trim() || tr("emptyTap");
        txt.classList.toggle("ph", !n.text.trim());
        if (ta.isConnected) ta.replaceWith(txt);
        var off = false;
        function release() {
          if (off) return;
          off = true;
          editing = null;
          render();
        }
        if (!down) return release();
        addEventListener("click", release, { once: true });
        setTimeout(release, 800); // the press may not end in a click (drag, text select)
      }
      ta.onblur = function () {
        finish(true);
      };
      ta.onkeydown = function (ev) {
        if (ev.key === "Escape") {
          ev.stopPropagation();
          finish(false);
        } else if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) finish(true);
      };
      editing = n.id; // blocks re-renders while typing
      txt.replaceWith(ta);
      ta.scrollTop = top;
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(at, at);
      ta.scrollTop = top;
    };
  }
  /**
   * The colour changed here, so the saved snapshot shows the old one: drop it. The card falls back to
   * the drawn page in the new colour, and the page retakes the picture next time the note is on screen.
   * @param {object} n - note
   */
  function dropShot(n) {
    chrome.storage.local.remove(PN.SHOT + n.id);
  }
  function openEditor(p, n) {
    ed = { p: p, n: n, color: n.color, done: !!n.done, urgent: n.pri === "urgent" };
    var dots = $("edDots");
    dots.textContent = "";
    PN.COLORS.forEach(function (c) {
      var b = h("button");
      b.type = "button";
      b.style.background = c;
      b.title = "Note color";
      b.onclick = function () {
        ed.color = c;
        paintEditor();
      };
      dots.append(b);
    });
    $("edText").value = n.text;
    $("edQ").textContent = n.hl ? "\u201c" + n.hl.text.replace(/\s+/g, " ").trim() + "\u201d" : n.anchor && n.quote ? "\u2316 " + n.quote : "";
    // header: site icon | domain over the page link
    $("edFav").replaceChildren(fav(p));
    $("edTtl").textContent = PN.host(p.url).replace(/^www\./, "");
    $("edPg").textContent = pagePath(p.url);
    $("edPg").title = p.title ? p.title + "\n" + p.url : p.url;
    paintEditor();
    editing = n.id;
    $("editor").classList.add("on");
    var t = $("edText");
    t.placeholder = tr("edPh");
    t.setAttribute("aria-label", tr("vwEdit"));
    t.focus();
    t.setSelectionRange(0, 0); // start at the beginning of the text
    t.scrollTop = 0;
  }
  /** Updates the editor colors and toggle buttons from the draft. */
  function paintEditor() {
    $("editor").style.setProperty("--c", ed.color); // header swatch + note tint
    Array.prototype.forEach.call($("edDots").children, function (b, i) {
      b.setAttribute("aria-pressed", String(PN.COLORS[i] === ed.color));
    });
    $("edUrg").setAttribute("aria-pressed", String(ed.urgent));
    $("edDone").setAttribute("aria-pressed", String(ed.done));
  }
  /**
   * Closes the editor, saving the draft if asked and something changed.
   * @param {boolean} save - true to save
   */
  function closeEditor(save) {
    if (!ed) return;
    var n = ed.n;
    if (save) {
      var text = $("edText").value.replace(/\s+$/, "");
      var changed = text !== n.text || ed.color !== n.color || ed.done !== !!n.done || ed.urgent !== (n.pri === "urgent");
      if (changed) {
        if (ed.color !== n.color) dropShot(n);
        n.text = text;
        n.color = ed.color;
        n.done = ed.done;
        n.pri = ed.urgent ? "urgent" : "";
        n.updatedAt = Date.now();
        savePage(ed.p);
        say("Saved");
      }
    }
    ed = null;
    editing = null;
    $("editor").classList.remove("on");
    render();
  }
  $("edUrg").onclick = function () {
    ed.urgent = !ed.urgent;
    paintEditor();
  };
  $("edDone").onclick = function () {
    ed.done = !ed.done;
    paintEditor();
  };
  $("edSave").onclick = function () {
    closeEditor(true);
  };
  $("edX").onclick = $("edNo").onclick = function () {
    closeEditor(false);
  };
  $("editor").onclick = function (e) {
    if (e.target === $("editor")) closeEditor(false);
  };
  $("edText").onkeydown = function (e) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) closeEditor(true);
  };

  // ---------- render ----------
  /** Redraws the site filter, tab counts and the notes grid. */
  function render() {
    if (editing) return; // don't yank the text box while typing
    var all = entries();
    var q = state.q.trim().toLowerCase();

    // site filter options
    var sites = Array.from(new Set(all.map(function (e) { return PN.host(e.page.url); }))).sort();
    // per site: note count + a favicon, shown in the site dropdown
    var per = {};
    all.forEach(function (e) {
      var k = PN.host(e.page.url);
      per[k] = per[k] || { n: 0, fav: "" };
      per[k].n++;
      if (!per[k].fav && e.page.favicon) per[k].fav = e.page.favicon;
    });
    var sel = $("site");
    sel.textContent = "";
    var o0 = h("option", "", tr("allSites"));
    o0.value = "";
    o0.dataset.n = all.length;
    sel.appendChild(o0);
    sites.forEach(function (s) {
      var o = h("option", "", s);
      o.value = s;
      o.dataset.n = per[s].n;
      o.dataset.fav = per[s].fav;
      sel.appendChild(o);
    });
    if (sites.indexOf(state.site) < 0) state.site = "";
    sel.value = state.site;
    siteDD.sync();

    paintFilter(all, q);
    $("clearF").hidden = !(state.site || state.color || q || fltActive());
    var list = all.filter(function (e) {
      return matches(e, q);
    });
    list.sort(function (a, b) {
      // the chosen sort always wins: by creation date, so edits / status never move a card
      if (state.sort === "old") return (a.note.createdAt || 0) - (b.note.createdAt || 0);
      if (state.sort === "site") return PN.host(a.page.url).localeCompare(PN.host(b.page.url)) || a.i - b.i;
      return (b.note.createdAt || 0) - (a.note.createdAt || 0);
    });
    $("shown").textContent = "";
    $("shown").append(h("b", "", PN.pad(list.length)), " of " + PN.pad(all.length) + " notes");
    var grid = $("grid");
    grid.textContent = "";
    grid.className = "grid " + VCLS[state.view] + (grid.classList.contains("swap") ? " swap" : ""); // keep a running fade
    if (!all.length) {
      var w = h("div", "hello");
      w.append(h("span", "mark"), h("h2", "", "Your notes will live here"), h("p", "", "Pin sticky notes on any website — everything you pin shows up in this list."));
      // how-to panel (like the popup's Tip): written for this page, where no website is open
      var tips = h("details", "tips"); // closed by default; the header opens it
      tips.insertAdjacentHTML("beforeend", '<summary class="guide-h"><svg class="bulb" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M9.8 21h4.4" fill="none" stroke="#d99a06" stroke-width="1.6" stroke-linecap="round"/><path d="M12 2.8a6.4 6.4 0 0 0-3.7 11.6c.5.4.8 1 .8 1.6v.5h5.8V16c0-.6.3-1.2.8-1.6A6.4 6.4 0 0 0 12 2.8z" fill="#fff3c4" stroke="#d99a06" stroke-width="1.6" stroke-linejoin="round"/></svg><span class="tt"><b data-i18n="dTipT">How to add notes</b><small data-i18n="dTipX">Add notes on websites, see them here.</small></span><a href="https://guetix.com/extensions/page-notes-extension#how-it-works" target="_blank" rel="noopener"><svg class="i16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2"/><path d="M6.8 5.6v4.8L10.4 8z" fill="currentColor" stroke="none"/></svg><span data-i18n="watch">Watch tour</span></a><svg class="chev" viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 6.5 3.5 3.5 3.5-3.5"/></svg></summary><ol class="tl"><li class="k-o"><svg class="i" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.5"/><path d="M1.5 6h9M6 1.5c1.3 1.3 1.9 2.8 1.9 4.5S7.3 9.2 6 10.5C4.7 9.2 4.1 7.7 4.1 6S4.7 2.8 6 1.5z"/></svg><span data-i18n-html="dTip1"></span></li><li class="k-y"><svg class="i" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 10h8M3.5 7.8l4-4.6 1.8 1.6-4 4.5H3.5z"/></svg><span data-i18n-html="dTip2"></span></li><li class="k-b"><svg class="i" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1.8 2 6.2h2.4V10h3.2V6.2H10z"/></svg><span data-i18n-html="dTip3"></span></li></ol><div class="legend" aria-label="Color legend"><span class="chip or"><svg class="i" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="3.2"/></svg><span data-i18n="open">Open</span></span><span class="chip g"><svg class="i" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.3 5 8.6l4.5-5.1"/></svg><span data-i18n="done">Done</span></span><span class="chip y"><svg class="i" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 10h8M3.5 7.8l4-4.6 1.8 1.6-4 4.5H3.5z"/></svg><span data-i18n="hl">Highlight</span></span><span class="chip b"><svg class="i" viewBox="0 0 12 12" aria-hidden="true"><rect x="1.8" y="1.8" width="8.4" height="8.4" rx="1" stroke-dasharray="1.6 1.3"/><circle cx="6" cy="6" r="1.3"/></svg><span data-i18n="el">Element</span></span><span class="chip p"><svg class="i" viewBox="0 0 12 12" aria-hidden="true"><path d="M5 7 7 5M4.2 5.6 3 6.8a1.7 1.7 0 0 0 2.4 2.4l1.2-1.2M7.8 6.4 9 5.2A1.7 1.7 0 0 0 6.6 2.8L5.4 4"/></svg><span data-i18n="link">Link</span></span></div>'); // static markup only
      PN.applyI18n(tips);
      w.append(tips);
      return grid.appendChild(w);
    }
    if (!list.length) {
      grid.appendChild(h("div", "empty", "Nothing matches these filters."));
      grid.firstChild.style.gridColumn = "1/-1";
      return;
    }
    lastList = list;
    var shots = store;
    if (state.view === "board") return board(grid, list);
    if (state.view === "timeline") return timeline(grid, list);
    list.forEach(function (e) {
      grid.appendChild(noteCard(e, shots, state.view));
    });
  }

  // ---------- view switcher (saved in settings.notesView) ----------
  var vsw = $("vsw");
  /** Marks the current view in the switcher; Select is not available on the board. */
  function paintView() {
    Array.prototype.forEach.call(vsw.children, function (b) {
      var on = b.getAttribute("data-v") === state.view;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    var isBoard = state.view === "board";
    $("selBtn").setAttribute("aria-disabled", String(isBoard));
    if (isBoard) $("selBtn").title = tr("vwNoSel");
    else $("selBtn").removeAttribute("title");
    if (isBoard && selecting) setSelecting(false);
  }
  /**
   * Switches the notes view (with a short fade) and saves it.
   * @param {string} v - one of VIEWS
   */
  function setView(v) {
    if (VIEWS.indexOf(v) < 0 || v === state.view) return;
    state.view = v;
    paintView();
    render();
    var g = $("grid");
    g.classList.remove("swap");
    void g.offsetWidth; // restart the fade
    g.classList.add("swap");
    chrome.storage.local.get("settings", function (r) {
      var s = (r && r.settings) || {};
      s.notesView = v; // merge: keep every other setting
      chrome.storage.local.set({ settings: s });
    });
  }
  $("grid").addEventListener("animationend", function (e) {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove("swap");
  });
  vsw.onclick = function (e) {
    var b = e.target.closest("button[data-v]");
    if (b) setView(b.getAttribute("data-v"));
  };
  // arrow keys move between views (radio group)
  vsw.onkeydown = function (e) {
    var i = VIEWS.indexOf(state.view);
    var rtl = document.documentElement.dir === "rtl";
    var next = { ArrowRight: rtl ? -1 : 1, ArrowDown: 1, ArrowLeft: rtl ? 1 : -1, ArrowUp: -1 }[e.key];
    if (e.key === "Home") i = 0;
    else if (e.key === "End") i = VIEWS.length - 1;
    else if (next) i = (i + next + VIEWS.length) % VIEWS.length;
    else return;
    e.preventDefault();
    setView(VIEWS[i]);
    vsw.querySelector('[data-v="' + VIEWS[i] + '"]').focus();
  };
  paintView();

  // ---------- filter dropdown (status + tags, saved in settings.notesFilter) ----------
  var fltBtn = $("fltBtn");
  var fltMenu = $("fltMenu");
  var fltItems = {}; // "status:open" / "tag:hl" -> menu item
  var fltLoaded = false; // saved filter restored once, on the first load
  /** @returns {number} how many filters are on (status other than All + each ticked tag) */
  function fltCount() {
    return (state.status !== "all" ? 1 : 0) + state.tags.length;
  }
  /** @returns {boolean} true when the dropdown filters anything */
  function fltActive() {
    return fltCount() > 0;
  }
  /**
   * Cleans a saved / requested filter: unknown values fall back to "all" / no tags.
   * @param {Object} f - { status, tags }
   * @returns {{status: string, tags: string[]}}
   */
  function fltClean(f) {
    f = f || {};
    var ids = TAGS.map(function (t) { return t[0]; });
    var st = ["all", "open", "done"].indexOf(f.status) > -1 ? f.status : "all";
    var tags = Array.isArray(f.tags) ? ids.filter(function (id) { return f.tags.indexOf(id) > -1; }) : [];
    return { status: st, tags: tags };
  }
  /**
   * Maps an old single "tab" id (all / open / done / urgent / hl / links) to the filter model.
   * @param {string} tab
   * @returns {{status: string, tags: string[]}}
   */
  function fltFromTab(tab) {
    if (tab === "open" || tab === "done") return { status: tab, tags: [] };
    return fltClean({ status: "all", tags: [tab] });
  }
  /** Saves the filter into settings.notesFilter (read-modify-write: keeps every other setting). */
  function saveFilter() {
    var f = { status: state.status, tags: state.tags.slice() };
    chrome.storage.local.get("settings", function (r) {
      var s = (r && r.settings) || {};
      s.notesFilter = f;
      chrome.storage.local.set({ settings: s });
    });
  }
  /**
   * Applies a filter (live), re-renders and saves it.
   * @param {Object} f - { status, tags }
   */
  function setFilter(f) {
    f = fltClean(f);
    state.status = f.status;
    state.tags = f.tags;
    render();
    saveFilter();
  }
  /**
   * Builds one menu row: indicator, colored dot, label, count chip.
   * @param {string} kind - "status" (radio) | "tag" (checkbox)
   * @param {Array} o - [id, i18n key, dot class]
   * @returns {HTMLElement}
   */
  function fltItem(kind, o) {
    var it = h("div", "fo");
    it.setAttribute("role", kind === "status" ? "menuitemradio" : "menuitemcheckbox");
    it.tabIndex = -1;
    it.setAttribute("data-k", kind);
    it.setAttribute("data-v", o[0]);
    it.append(h("span", "ind"), h("span", "dot " + o[2]), h("span", "fl"), h("em", "", "0"));
    it.firstChild.setAttribute("aria-hidden", "true");
    fltItems[kind + ":" + o[0]] = it;
    return it;
  }
  (function buildFilter() {
    var g1 = h("div", "fg");
    var g2 = h("div", "fg");
    [[g1, "fltStatus", "status", STATUSES], [g2, "fltTags", "tag", TAGS]].forEach(function (x) {
      var hd = h("div", "fh");
      hd.id = "fltH-" + x[2];
      hd.setAttribute("data-i18n", x[1]);
      x[0].setAttribute("role", "group");
      x[0].setAttribute("aria-labelledby", hd.id);
      x[0].append(hd);
      x[3].forEach(function (o) {
        x[0].append(fltItem(x[2], o));
      });
    });
    var ft = h("div", "ffoot");
    var cl = h("button", "fx");
    var ok = h("button", "fok");
    cl.type = ok.type = "button";
    cl.id = "fltClear";
    ok.id = "fltOk";
    ft.append(cl, ok);
    fltMenu.append(g1, h("div", "fsep"), g2, ft);
  })();
  /**
   * Paints the dropdown: button label + badge, and each option's checked / count / disabled state.
   * Counts use the current scope (search + site + color) and answer "what would I get if I picked this":
   *  - a Status option counts notes in scope with that status AND every ticked tag;
   *  - a Tag option counts notes in scope with the chosen status AND that one tag (other ticked tags ignored).
   * Options with 0 look disabled (still shown) unless they are already selected.
   * @param {Array} all - every entry
   * @param {string} q - lowercase search text
   */
  function paintFilter(all, q) {
    /** @param {Object} f @returns {number} */
    function count(f) {
      var c = 0;
      for (var i = 0; i < all.length; i++) if (matches(all[i], q, f)) c++;
      return c;
    }
    /** @param {HTMLElement} it @param {string} key @param {number} c @param {boolean} on */
    function paintItem(it, key, c, on) {
      it.querySelector(".fl").textContent = tr(key);
      it.querySelector("em").textContent = String(c);
      it.setAttribute("aria-checked", String(on));
      if (!c && !on) it.setAttribute("aria-disabled", "true");
      else it.removeAttribute("aria-disabled");
    }
    STATUSES.forEach(function (o) {
      paintItem(fltItems["status:" + o[0]], o[1], count({ status: o[0], tags: state.tags }), state.status === o[0]);
    });
    TAGS.forEach(function (o) {
      paintItem(fltItems["tag:" + o[0]], o[1], count({ status: state.status, tags: [o[0]] }), state.tags.indexOf(o[0]) > -1);
    });
    Array.prototype.forEach.call(fltMenu.querySelectorAll("[data-i18n]"), function (x) {
      x.textContent = tr(x.getAttribute("data-i18n"));
    });
    $("fltClear").textContent = tr("fltClear");
    $("fltOk").textContent = tr("fltOk");
    // label: "All notes" | "Open · Urgent, Highlights"
    var parts = [];
    if (state.status !== "all") parts.push(tr(state.status === "open" ? "fltOpen" : "fltDone"));
    var tl = TAGS.filter(function (o) { return state.tags.indexOf(o[0]) > -1; }).map(function (o) { return tr(o[1]); });
    if (tl.length) parts.push(tl.join(", "));
    var n = fltCount();
    var lbl = parts.length ? parts.join(" · ") : tr("fltAll");
    $("fltLbl").textContent = lbl;
    $("fltN").textContent = String(n);
    $("fltN").hidden = !n;
    $("fltX").hidden = !n;
    $("fltX").setAttribute("aria-label", tr("fltReset"));
    $("fltX").title = tr("fltReset");
    $("flt").classList.toggle("on", !!n);
    fltBtn.setAttribute("aria-label", tr("fltLbl") + ": " + lbl);
    fltBtn.title = lbl;
  }
  /** @returns {HTMLElement[]} the menu rows that can take focus (not disabled) */
  function fltFocusable() {
    return Array.prototype.filter.call(fltMenu.querySelectorAll(".fo"), function (x) {
      return x.getAttribute("aria-disabled") !== "true";
    });
  }
  /**
   * Opens the menu and focuses the selected (or first) option.
   */
  function openFilter() {
    fltMenu.hidden = false;
    fltBtn.setAttribute("aria-expanded", "true");
    var list = fltFocusable();
    var cur = list.filter(function (x) { return x.getAttribute("aria-checked") === "true"; })[0] || list[0];
    if (cur) cur.focus();
  }
  /**
   * Closes the menu.
   * @param {boolean} [back] - return focus to the button
   */
  function closeFilter(back) {
    if (fltMenu.hidden) return;
    fltMenu.hidden = true;
    fltBtn.setAttribute("aria-expanded", "false");
    if (back) fltBtn.focus();
  }
  /**
   * Toggles one option (radio for status, checkbox for tags).
   * @param {HTMLElement} it - menu row
   */
  function pickFilter(it) {
    if (!it || it.getAttribute("aria-disabled") === "true") return;
    var v = it.getAttribute("data-v");
    if (it.getAttribute("data-k") === "status") return setFilter({ status: v, tags: state.tags });
    var tags = state.tags.slice();
    var i = tags.indexOf(v);
    if (i > -1) tags.splice(i, 1);
    else tags.push(v);
    setFilter({ status: state.status, tags: tags });
  }
  fltBtn.onclick = function () {
    if (fltMenu.hidden) openFilter();
    else closeFilter(false);
  };
  fltBtn.onkeydown = function (e) {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      openFilter();
    }
  };
  $("fltX").onclick = function (e) {
    e.stopPropagation(); // clear only, don't toggle the menu
    setFilter({ status: "all", tags: [] });
    fltBtn.focus();
  };
  fltMenu.onclick = function (e) {
    var it = e.target.closest(".fo");
    if (it) {
      pickFilter(it);
      it.focus();
    }
  };
  $("fltClear").onclick = function () {
    setFilter({ status: "all", tags: [] });
    var first = fltFocusable()[0];
    if (first) first.focus();
  };
  $("fltOk").onclick = function () {
    closeFilter(true);
  };
  fltMenu.onkeydown = function (e) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation(); // don't also leave select mode
      return closeFilter(true);
    }
    var it = e.target.closest(".fo");
    if (!it) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      return pickFilter(it);
    }
    var list = fltFocusable();
    var i = list.indexOf(it);
    if (e.key === "ArrowDown") i = (i + 1) % list.length;
    else if (e.key === "ArrowUp") i = (i - 1 + list.length) % list.length;
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = list.length - 1;
    else return;
    e.preventDefault();
    if (list[i]) list[i].focus();
  };
  // click outside / focus leaving the dropdown closes it
  document.addEventListener("mousedown", function (e) {
    if (!fltMenu.hidden && !$("flt").contains(e.target)) closeFilter(false);
  });
  $("flt").addEventListener("focusout", function (e) {
    if (e.relatedTarget && !$("flt").contains(e.relatedTarget)) closeFilter(false);
  });

  // ---------- site + sort dropdowns (a <select> kept hidden as the source of truth) ----------
  var DD_GLOBE = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="M2.5 8h11M8 2.5c1.6 1.6 2.3 3.4 2.3 5.5S9.6 11.9 8 13.5C6.4 11.9 5.7 10.1 5.7 8S6.4 4.1 8 2.5"/></svg>';
  var DD_SORT = {
    new: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 3v10M2.5 11l2 2 2-2M9 4h4.5M9 7.5h3.2M9 11h2"/></svg>',
    old: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 13V3M2.5 5l2-2 2 2M9 4h2M9 7.5h3.2M9 11h4.5"/></svg>',
    site: DD_GLOBE
  };
  var DD_CHECK = '<svg class="ddck" viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7"/></svg>';
  /**
   * Turns a native <select> (inside its .fsel label) into the dashboard dropdown: a button showing
   * "Label  Value" and a listbox. Picking an option sets select.value and fires "change", so the
   * select's own handler keeps working.
   * @param {string} id - select id
   * @param {function(HTMLOptionElement):Node} icon - leading icon for an option
   * @param {boolean} [search] - show a search box when the list is long
   * @returns {{sync: function()}} sync - repaint the button after select.value / options change
   */
  function dropdown(id, icon, search) {
    var sel = $(id);
    var lab = sel.closest("label");
    var wrap = h("div", "dd dd-" + id);
    var name = lab.firstElementChild.textContent;
    var btn = h("button", "ddbtn");
    btn.type = "button";
    btn.setAttribute("aria-haspopup", "listbox");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", sel.getAttribute("aria-label"));
    var ico = h("span", "ddi");
    var val = h("span", "ddv");
    var chev = h("span", "ddch");
    chev.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 6.5 3.5 3.5 3.5-3.5"/></svg>';
    btn.append(ico, h("span", "ddk", name), val, chev);
    var menu = h("div", "ddmenu");
    menu.hidden = true;
    var q = h("input", "ddq");
    q.type = "search";
    var list = h("div", "ddl");
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", sel.getAttribute("aria-label"));
    menu.append(h("div", "fh", name), q, list);
    sel.hidden = true;
    wrap.append(btn, menu, sel);
    lab.replaceWith(wrap);

    function sync() {
      var o = sel.options[sel.selectedIndex];
      val.textContent = o ? o.textContent : "";
      ico.textContent = "";
      if (o) ico.append(icon(o));
      wrap.classList.toggle("on", sel.selectedIndex > 0 && id === "site");
    }
    function rows() {
      return Array.prototype.filter.call(list.children, function (r) {
        return !r.hidden;
      });
    }
    function build() {
      list.textContent = "";
      Array.prototype.forEach.call(sel.options, function (o) {
        var r = h("div", "ddo");
        r.setAttribute("role", "option");
        r.tabIndex = -1;
        r.dataset.v = o.value;
        r.setAttribute("aria-selected", String(o.selected));
        r.append(icon(o), h("span", "fl", o.textContent));
        if (o.dataset.n) r.append(h("em", "", o.dataset.n));
        r.insertAdjacentHTML("beforeend", DD_CHECK);
        list.append(r);
      });
      q.value = "";
      q.placeholder = tr("searchSites"); // read on open: the language loads after this file runs
      q.setAttribute("aria-label", q.placeholder);
      q.hidden = !(search && sel.options.length > 7);
    }
    function open() {
      build();
      menu.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      if (!q.hidden) q.focus();
      else (list.querySelector("[aria-selected=true]") || list.firstChild).focus();
    }
    function close(refocus) {
      if (menu.hidden) return;
      menu.hidden = true;
      btn.setAttribute("aria-expanded", "false");
      if (refocus) btn.focus();
    }
    function choose(r) {
      if (r.dataset.v !== sel.value) {
        sel.value = r.dataset.v;
        sel.dispatchEvent(new Event("change"));
      }
      sync();
      close(true);
    }
    btn.onclick = function () {
      if (menu.hidden) open();
      else close(false);
    };
    btn.onkeydown = function (e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        open();
      }
    };
    q.oninput = function () {
      var s = q.value.trim().toLowerCase();
      Array.prototype.forEach.call(list.children, function (r) {
        r.hidden = !!s && r.dataset.v.indexOf(s) < 0;
      });
    };
    list.onclick = function (e) {
      var r = e.target.closest(".ddo");
      if (r) choose(r);
    };
    menu.onkeydown = function (e) {
      var rs = rows();
      var i = rs.indexOf(document.activeElement);
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        return close(true);
      }
      if (e.key === "Tab") return close(false);
      if ((e.key === "Enter" || e.key === " ") && i > -1) {
        e.preventDefault();
        return choose(rs[i]);
      }
      if (e.key === "Enter" && rs.length) {
        e.preventDefault();
        return choose(rs[0]); // Enter in the search box picks the first match
      }
      if (e.key === "ArrowDown") i = Math.min(rs.length - 1, i + 1);
      else if (e.key === "ArrowUp") i = i < 1 && !q.hidden ? -1 : Math.max(0, i - 1);
      else if (e.key === "Home") i = 0;
      else if (e.key === "End") i = rs.length - 1;
      else return;
      e.preventDefault();
      if (i < 0) q.focus();
      else if (rs[i]) rs[i].focus();
    };
    document.addEventListener("mousedown", function (e) {
      if (!wrap.contains(e.target)) close(false);
    });
    wrap.addEventListener("focusout", function (e) {
      if (e.relatedTarget && !wrap.contains(e.relatedTarget)) close(false);
    });
    sync();
    return { sync: sync };
  }
  /**
   * Site icon for the site dropdown: the page favicon, else its first letter; a globe for "All sites".
   * @param {HTMLOptionElement} o
   * @returns {Node}
   */
  function siteIcon(o) {
    if (!o.value) {
      var g = h("span", "ddg");
      g.innerHTML = DD_GLOBE;
      return g;
    }
    return fav({ url: "https://" + o.value + "/", favicon: o.dataset.fav });
  }
  var siteDD = dropdown("site", siteIcon, true);
  dropdown("sort", function (o) {
    var g = h("span", "ddg");
    g.innerHTML = DD_SORT[o.value] || "";
    return g;
  });

  // ---------- controls ----------
  PN.COLORS.forEach(function (c) {
    var b = h("button", "cf");
    b.type = "button";
    b.style.background = c;
    b.setAttribute("aria-label", "Only " + c + " notes");
    b.setAttribute("aria-pressed", "false");
    b.onclick = function () {
      state.color = state.color === c ? null : c;
      Array.prototype.forEach.call($("colors").children, function (x) {
        x.setAttribute("aria-pressed", String(x === b && state.color === c));
      });
      render();
    };
    $("colors").appendChild(b);
  });
  $("site").onchange = function (e) {
    state.site = e.target.value;
    render();
  };
  $("clearF").onclick = function () {
    state.site = "";
    state.color = null;
    state.q = "";
    state.status = "all";
    state.tags = [];
    saveFilter();
    $("q").value = "";
    Array.prototype.forEach.call($("colors").children, function (x) {
      x.setAttribute("aria-pressed", "false");
    });
    render();
  };
  // footer
  $("yr").textContent = new Date().getFullYear();
  $("ftVer").textContent = chrome.runtime.getManifest().version;
  $("ftExport").onclick = function () {
    $("export").click(); // same export as Settings > Your data
  };
  $("ftImport").onclick = function () {
    $("import").click();
  };
  $("ftKeys").onclick = function () {
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  };
  $("ftSettings").onclick = function () {
    location.hash = "settings";
    scrollTo({ top: 0, behavior: "smooth" });
  };
  // settings group nav: jump + highlight the group in view
  var snav = $("snav");
  // settings tabs: "All" or one group at a time (sticky bar under the header)
  Array.prototype.forEach.call(snav.children, function (x) {
    x.setAttribute("role", "tab");
    if (!x.hasAttribute("aria-selected")) x.setAttribute("aria-selected", "false");
  });
  snav.onclick = function (e) {
    var b = e.target.closest("button[data-to]");
    if (!b) return;
    var to = b.getAttribute("data-to");
    var keep = to === "all" ? null : $(to).closest("section");
    document.querySelectorAll("#vSettings section").forEach(function (sec) {
      sec.classList.toggle("tab-off", !!keep && sec !== keep);
    });
    Array.prototype.forEach.call(snav.children, function (x) {
      x.setAttribute("aria-selected", String(x === b));
    });
    var top = $("vSettings").getBoundingClientRect().top + scrollY - 70;
    if (scrollY > top) scrollTo({ top: top, behavior: "smooth" });
  };
  // the tab bar sits right under the sticky header, whatever its height
  var topBar = document.querySelector(".top");
  if (topBar) {
    var setTopH = function () {
      document.documentElement.style.setProperty("--toph", topBar.offsetHeight + "px");
    };
    setTopH();
    addEventListener("resize", setTopH);
  }
  $("sort").onchange = function (e) {
    state.sort = e.target.value;
    render();
  };
  $("q").oninput = function (e) {
    state.q = e.target.value;
    render();
  };
  // "/" focuses the search box
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement === document.body) {
      e.preventDefault();
      $("q").focus();
    }
  });

  // ---------- select + share ----------
  /**
   * Selected entries among the shown ones.
   * @returns {Array<Object>}
   */
  function selected() {
    return lastList.filter(function (e) {
      return picked[e.note.id];
    });
  }
  /** Updates the selected count and enables / disables the selection actions. */
  function updateShare() {
    var n = selected().length;
    $("selN").textContent = String(n);
    ["shMenuBtn", "bDone", "bOpen", "bUrg", "bDel"].forEach(function (id) {
      $(id).disabled = !n;
    });
  }
  /**
   * Turns select mode on or off (off clears the selection).
   * @param {boolean} v - on
   */
  function setSelecting(v) {
    selecting = v;
    if (!v) picked = {};
    $("vNotes").classList.toggle("selecting", v);
    $("selBtn").setAttribute("aria-pressed", String(v));

    render();
    updateShare();
  }
  /**
   * Selected notes as readable Markdown, grouped by page.
   * @returns {string}
   */
  function asText() {
    return PN.asText(selected());
  }
  /**
   * Export file name with today's date.
   * @returns {string}
   */
  function fileName() {
    return "page-notes-" + new Date().toISOString().slice(0, 10) + ".md";
  }
  /** Downloads the selected notes as a .md file. */
  function download() {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([asText()], { type: "text/markdown" }));
    a.download = fileName();
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
    }, 2000);
    say("Downloaded " + selected().length + " notes");
  }
  /** Opens the share sheet with app links for the selected notes. */
  function openSheet() {
    var text = asText();
    var short = text.length > 1800 ? text.slice(0, 1800) + "\n…" : text;
    var enc = encodeURIComponent(short);
    var apps = $("apps");
    apps.textContent = "";
    /**
     * Adds one share target (link or button) to the sheet.
     * @param {string} name - app name
     * @param {string} color - badge color
     * @param {string} mark - badge letter
     * @param {string|null} href - share URL, or null for a button
     * @param {Function} [fn] - click handler
     */
    var app = function (name, color, mark, href, fn) {
      var a = h(href ? "a" : "button");
      if (href) {
        a.href = href;
        a.target = "_blank";
        a.rel = "noopener";
      } else a.type = "button";
      var i = h("i", "", mark);
      i.style.background = color;
      a.append(i, name);
      if (fn) a.onclick = fn;
      apps.append(a);
    };
    app("WhatsApp", "#25d366", "W", "https://wa.me/?text=" + enc);
    app("Telegram", "#229ed9", "T", "https://t.me/share/url?url=" + encodeURIComponent("https://guetix.com") + "&text=" + enc);
    app("X", "#141414", "X", "https://x.com/intent/post?text=" + encodeURIComponent(short.slice(0, 260)));
    app("LinkedIn", "#0a66c2", "in", "https://www.linkedin.com/feed/?shareActive=true&text=" + enc);
    app("Email", "#ff5b14", "@", "mailto:?subject=" + encodeURIComponent("Page Notes") + "&body=" + enc);
    app("Download", "#57534e", "\u2B07", null, function () {
      download();
      closeSheet();
    });
    $("shSub").textContent = selected().length + " notes - sent as text. Download the .md file to attach it anywhere.";
    $("sheet").classList.add("on");
  }
  /** Closes the share sheet. */
  function closeSheet() {
    $("sheet").classList.remove("on");
  }
  $("selBtn").onclick = function () {
    if (state.view === "board") return say(tr("vwNoSel"));
    setSelecting(!selecting);
  };
  $("selDone").onclick = function () {
    setSelecting(false);
  };
  $("selAll").onclick = function () {
    lastList.forEach(function (e) {
      picked[e.note.id] = true;
    });
    render();
    updateShare();
  };
  // ---------- bulk actions on the selection ----------
  /**
   * Runs a change on every selected note, then saves each touched page once.
   * @param {Function} fn - called with each entry
   * @param {string} [msg] - toast message
   */
  function bulk(fn, msg) {
    var touched = {};
    selected().forEach(function (e) {
      fn(e);
      touched[e.page.url] = e.page;
    });
    var o = {};
    Object.keys(touched).forEach(function (u) {
      var pg = touched[u];
      pg.updatedAt = Date.now();
      if (pg.notes.length) o[PN.PREFIX + u] = pg;
      else chrome.storage.local.remove(PN.PREFIX + u);
    });
    chrome.storage.local.set(o);
    if (msg) say(msg);
  }
  $("bDone").onclick = function () {
    bulk(function (e) {
      e.note.done = true;
    }, "Marked as done");
  };
  $("bOpen").onclick = function () {
    bulk(function (e) {
      e.note.done = false;
    }, "Reopened");
  };
  $("bUrg").onclick = function () {
    // all urgent already → remove the flag, else flag them all
    var all = selected().every(function (e) {
      return e.note.pri === "urgent";
    });
    bulk(function (e) {
      e.note.pri = all ? "" : "urgent";
    }, all ? "No longer urgent" : "Marked as urgent");
  };
  /** Every delete asks first. */
  var onConfirm = null; // action to run when the delete is confirmed
  /**
   * Opens the delete confirm dialog.
   * @param {number} n - how many notes
   * @param {Function} fn - runs on confirm
   */
  function askDelete(n, fn) {
    onConfirm = fn;
    $("cfTitle").textContent = n === 1 ? "Delete this note?" : "Delete " + n + " notes?";
    $("cfText").textContent = (n === 1 ? "It will be removed from its page and from this list." : "They will be removed from every page and from this list.") + " This can't be undone.";
    $("confirm").classList.add("on");
    $("cfNo").focus();
  }
  $("bDel").onclick = function () {
    askDelete(selected().length, deleteSelected);
  };
  $("cfNo").onclick = function () {
    $("confirm").classList.remove("on");
  };
  $("confirm").onclick = function (e) {
    if (e.target === $("confirm")) $("confirm").classList.remove("on");
  };
  $("cfYes").onclick = function () {
    $("confirm").classList.remove("on");
    var fn = onConfirm;
    onConfirm = null;
    if (fn) fn();
  };
  /** Deletes the selected notes and their snapshots. */
  function deleteSelected() {
    var sel = selected();
    var n = sel.length;
    var ids = {};
    sel.forEach(function (e) {
      ids[e.note.id] = 1;
    });
    bulk(function (e) {
      e.page.notes = e.page.notes.filter(function (x) {
        return !ids[x.id];
      });
    });
    chrome.storage.local.remove(
      Object.keys(ids).map(function (id) {
        return PN.SHOT + id;
      }),
    );
    picked = {};
    updateShare();
    say(n === 1 ? "1 note deleted" : n + " notes deleted");
  }
  $("selClear").onclick = function () {
    picked = {};
    render();
    updateShare();
  };
  $("shMenuBtn").onclick = function (e) {
    e.stopPropagation();
    $("shMenu").classList.toggle("on");
  };
  // click outside closes the share menu
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".shwrap")) $("shMenu").classList.remove("on");
  });
  $("shDl").onclick = download;
  $("shCopy").onclick = function () {
    navigator.clipboard.writeText(asText()).then(function () {
      say("Notes copied as text");
    });
  };
  $("shShare").onclick = function () {
    // system share sheet with the file when the browser supports it, else our share options
    var file = typeof File === "function" ? new File([asText()], fileName(), { type: "text/markdown" }) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: "Page Notes" }).catch(function () {});
    } else openSheet();
  };
  $("shClose").onclick = closeSheet;
  $("sheet").onclick = function (e) {
    if (e.target === $("sheet")) closeSheet();
  };
  // Escape closes the top layer: editor, confirm, sheet, then select mode
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if ($("editor").classList.contains("on")) closeEditor(false);
      else if ($("confirm").classList.contains("on")) $("confirm").classList.remove("on");
      else if ($("sheet").classList.contains("on")) closeSheet();
      else if (selecting) setSelecting(false);
    }
  });

  // ---------- data ----------
  var loaded = false; // first load: the status shows in the grid (like "no notes"); later reloads use the small pill
  /**
   * Status page in the grid while the first load is slow ("busy") or failed ("err", with Try again).
   * @param {?string} st - "busy" | "err" | null (done: render() fills the grid)
   * @param {Function} retry - loads again
   */
  function loadState(st, retry) {
    if (!st) return;
    var grid = $("grid");
    var w = h("div", "hello st " + st);
    w.setAttribute("role", st === "err" ? "alert" : "status");
    var ic = h("span", "st-ic");
    ic.setAttribute("aria-hidden", "true");
    if (st === "busy")
      PN.COLORS.forEach(function (c) {
        var d = h("i");
        d.style.background = c;
        ic.appendChild(d);
      });
    w.append(ic, h("h2", "", tr(st === "err" ? "ldErrT" : "ldNotes")));
    if (st === "err") {
      var b = h("button", "btn", tr("retry"));
      b.type = "button";
      b.onclick = retry;
      w.append(h("p", "", tr("ldErrX")), b);
    }
    grid.textContent = "";
    grid.appendChild(w);
    if (b) b.focus();
  }
  /** Reloads all storage and re-renders (status when slow, Try again on failure). */
  function refresh() {
    PN.withLoader(function (done, fail) {
      chrome.storage.local.get(null).then(function (s) {
        store = s;
        PN.setDev(s.settings && s.settings.dev); // inspect mode shows its own notes
        var nv = s.settings && s.settings.notesView;
        if (nv && VIEWS.indexOf(nv) > -1 && nv !== state.view) {
          state.view = nv;
          paintView();
        }
        if (!fltLoaded) {
          fltLoaded = true;
          // a one-shot ?tab=open|done|urgent|hl|links link wins over the saved filter
          var tab = new URLSearchParams(location.search).get("tab");
          var f = tab ? fltFromTab(tab) : fltClean(s.settings && s.settings.notesFilter);
          state.status = f.status;
          state.tags = f.tags;
        }
        render();
        loaded = true;
        done();
      }).catch(fail);
    }, loaded ? null : loadState);
  }
  chrome.storage.onChanged.addListener(refresh);
  // resolve the UI language first (timeline day names, labels), then load the notes
  if (PN.initLang) PN.initLang(refresh);
  else refresh();
})();
