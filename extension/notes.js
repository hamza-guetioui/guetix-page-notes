/* Guetix Page Notes — "All my notes": every note from every page, as visual cards.
 *
 * Main parts:
 *  - Routing between All notes, Guides (#guides) and Settings (#settings).
 *  - Helpers (DOM builder, toast, storage save, filters).
 *  - Note cards, the sticky-note editor, render() of the grid.
 *  - Controls: tabs, color / site / sort / search filters, footer, settings nav.
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
    "a-open": '<path d="M9 3h4v4M13 3 7.5 8.5M11.5 9.5V13h-8V5H7"/>',
    "a-done": '<path d="m3.5 8.5 3 3 6-7"/>',
    "a-reopen": '<path d="M3 8a5 5 0 1 0 1.5-3.6M3 2.5V5h2.5"/>',
    "a-link": '<path d="M6.7 9.3 9.3 6.7M5.6 7.5 4 9.1a2.3 2.3 0 0 0 3.2 3.2l1.6-1.6M10.4 8.5 12 6.9a2.3 2.3 0 0 0-3.2-3.2L7.2 5.3"/>',
    "a-edit": '<path d="M10.5 3 13 5.5 6 12.5H3.5V10z"/>',
    "a-del": '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9"/>',
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
  function actions(c, e) {
    var p = e.page;
    var n = e.note;
    var acts = h("div", "acts");
    var act = function (key, cls, fn) {
      var b = h("button", cls);
      b.type = "button";
      b.title = tr(key);
      b.setAttribute("aria-label", tr(key));
      b.insertAdjacentHTML("beforeend", '<svg viewBox="0 0 16 16" aria-hidden="true">' + AI[cls] + "</svg>"); // static markup only
      b.onclick = fn;
      acts.appendChild(b);
      return b;
    };
    act("vwOpen", "a-open", function () {
      open(p, n);
    });
    act(n.done ? "vwReopen" : "vwDone", n.done ? "a-reopen" : "a-done", function () {
      n.done = !n.done; // status change keeps the date → the list order stays the same
      savePage(p);
      say(n.done ? "Marked as done" : "Reopened");
    });
    var cl = act("vwCopy", "a-link", function () {
      navigator.clipboard.writeText(PN.noteLink(p.url, n.id)).then(
        function () {
          cl.classList.add("ok");
          say("Link to this note copied");
          setTimeout(function () {
            cl.classList.remove("ok");
          }, 1600);
        },
        function () {
          say("Couldn't copy - clipboard blocked");
        },
      );
    });
    act("vwEdit", "a-edit", function () {
      openEditor(p, n);
    });
    act("vwDel", "a-del", function () {
      askDelete(1, function () {
        p.notes = p.notes.filter(function (x) {
          return x.id !== n.id;
        });
        chrome.storage.local.remove(PN.SHOT + n.id);
        savePage(p);
        say("Note deleted");
      });
    });
    c.appendChild(acts);
  }
  /**
   * Top row: site icon + short name · time.
   * @param {Object} e - { page, note, i } entry
   * @returns {HTMLElement}
   */
  function topRow(e) {
    var host = PN.host(e.page.url);
    var top = h("div", "ntop");
    var nm = h("span", "nm", siteShort(host));
    nm.title = host;
    top.append(fav(e.page), nm, h("span", "k", PN.when(e.note.updatedAt || e.note.createdAt)));
    return top;
  }
  /**
   * Grid card for the sticky and preview views.
   * @param {Object} e - { page, note, i } entry
   * @param {Object} shots - storage snapshot holding the note screenshots (PN.SHOT + id)
   * @param {string} view - "sticky" | "preview"
   * @returns {HTMLElement}
   */
  function noteCard(e, shots, view) {
    var p = e.page;
    var n = e.note;
    var c = shell(e);
    var txt = h("div", "t", n.text.trim() || "(empty note)");
    var bot = h("div", "bot");
    pills(n, bot);
    bot.append(pageLink(e, "pgt"));
    if (view === "preview") {
      // where the note sits: the saved snapshot, else a drawn mini page with the note on it
      var sh = h("a", "sh");
      sh.href = PN.noteLink(p.url, n.id);
      sh.title = "Open the page at this note";
      sh.setAttribute("aria-label", "Open the page at this note");
      sh.onclick = function (ev) {
        ev.preventDefault();
        open(p, n);
      };
      var img = shots[PN.SHOT + n.id];
      if (img) {
        var im = h("img");
        im.alt = "Where this note sits on " + PN.host(p.url);
        im.loading = "lazy";
        im.src = img;
        sh.append(im, h("span", "mk"));
      } else {
        [[16, 12], [28, 34], [104, 12], [116, 26]].forEach(function (x) {
          var ln = h("i");
          ln.style.top = x[0] + "px";
          ln.style.insetInlineEnd = x[1] + "px";
          sh.append(ln);
        });
        var b = h("b");
        b.style.top = 40 + (Math.abs(n.y || 0) % 34) + "px";
        b.style.insetInlineStart = 16 + (Math.abs(n.x || 0) % 18) + "px";
        sh.append(b);
      }
      var bd = h("div", "bd");
      bd.append(topRow(e), txt, bot);
      c.append(sh, bd);
    } else c.append(topRow(e), txt, bot);
    actions(c, e);
    return c;
  }
  /**
   * Timeline row: text, site · page · time, pills + open arrow.
   * @param {Object} e - { page, note, i } entry
   * @returns {HTMLElement}
   */
  function rowCard(e) {
    var p = e.page;
    var n = e.note;
    var c = shell(e);
    var s = h("div", "s");
    var host = PN.host(p.url);
    var nm = h("span", "nm", siteShort(host));
    nm.title = host;
    s.append(fav(p), nm, h("span", "sep", "·"), pageLink(e, "pgt"), h("span", "sep", "·"), h("span", "k", PN.when(n.updatedAt || n.createdAt)));
    var r = h("div", "r");
    pills(n, r);
    var go = h("button", "go");
    go.type = "button";
    go.title = tr("vwOpen");
    go.setAttribute("aria-label", tr("vwOpen"));
    go.insertAdjacentHTML("beforeend", '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>'); // static markup only
    go.onclick = function () {
      open(p, n);
    };
    r.append(go);
    c.append(h("div", "t", n.text.trim() || "(empty note)"), s, r);
    actions(c, e);
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
    c.append(h("div", "t", n.text.trim() || "(empty note)"));
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
    $("edPg").textContent = (p.title || PN.host(p.url)) + " \u00b7 " + PN.host(p.url);
    paintEditor();
    editing = n.id;
    $("editor").classList.add("on");
    var t = $("edText");
    t.focus();
    t.setSelectionRange(t.value.length, t.value.length);
  }
  /** Updates the editor colors and toggle buttons from the draft. */
  function paintEditor() {
    $("edNote").style.background = ed.color;
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
  $("edNo").onclick = function () {
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
    var sel = $("site");
    sel.textContent = "";
    var o0 = h("option", "", "All sites (" + sites.length + ")");
    o0.value = "";
    sel.appendChild(o0);
    sites.forEach(function (s) {
      var o = h("option", "", s);
      o.value = s;
      sel.appendChild(o);
    });
    if (sites.indexOf(state.site) < 0) state.site = "";
    sel.value = state.site;

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
  /** Reloads all storage and re-renders. */
  function refresh() {
    chrome.storage.local.get(null, function (s) {
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
    });
  }
  chrome.storage.onChanged.addListener(refresh);
  // resolve the UI language first (timeline day names, labels), then load the notes
  if (PN.initLang) PN.initLang(refresh);
  else refresh();
})();
