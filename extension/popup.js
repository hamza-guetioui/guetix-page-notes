/* Guetix Page Notes — toolbar popup: three tabs (Home / Notes / Sites), counts, notes + quick actions.
 *
 * Main parts:
 *  - Helpers: tab messaging, DOM builder, icons.
 *  - Note cards and empty-state cards.
 *  - Tabs + site rows.
 *  - render(): counts, Home (this page's notes), Notes (scope pills, search, sort, quick filters), Sites.
 *  - Startup and UI event handlers.
 *
 * Globals: PN (from shared.js: storage keys, i18n via PN.t / PN.tn, formatting helpers),
 * chrome.storage.local (all notes data, re-rendered on every change), chrome.tabs, chrome.runtime.
 */
(function () {
  /** Shortcut for document.getElementById. */
  var $ = function (id) {
    return document.getElementById(id);
  };
  var manifest = chrome.runtime.getManifest();
  var HOW_URL = (manifest.homepage_url || "https://guetix.com/extensions/page-notes-extension") + "#how-it-works";
  // side panel (vs dropdown popup): stays open, follows the active tab, fills the panel width
  var inPanel = !(chrome.extension.getViews && chrome.extension.getViews({ type: "popup" }).indexOf(window) >= 0);
  var close = inPanel ? function () {} : function () { window.close(); };
  if (inPanel) document.documentElement.classList.add("panel");
  var tab = null; // the active browser tab
  var tabKey = ""; // storage key of the active tab's page
  var tabHost = ""; // host of the active tab ("" when unsupported)
  // tab: "home" | "notes" | "sites" · view (Notes tab): "recent" | "page" | "site" · domain: "" = all sites
  // q / sq: Notes / Sites search text · sort: "new" | "old"
  var state = { tab: "home", view: "recent", domain: null, quick: "all", q: "", sq: "", sort: "new" };
  // shortcuts as the browser really assigned them (empty when taken by another extension / unset)
  var keys = {};
  var sitesCache = []; // last site list (for the Sites search suggestions)
  if (chrome.commands && chrome.commands.getAll) {
    chrome.commands.getAll(function (list) {
      (list || []).forEach(function (c) {
        keys[c.name] = c.shortcut || "";
      });
      $("kNew").textContent = keys["place-note"] || "";
      $("kNew").hidden = !keys["place-note"];
      if (lastStore && lastStore.__ready) render(lastStore);
    });
  }
  var lastStore = {}; // last full storage snapshot, used to re-render
  var guideSet = false; // "How it works" guide set up once
  $("ver").textContent = "v" + manifest.version;
  var PLUS = '<svg class="i16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>';
  // empty-state illustration: a sticky note on a soft blob with a little spark (static markup)
  var ILLUS =
    '<svg class="illus" viewBox="0 0 120 80" aria-hidden="true"><ellipse cx="58" cy="50" rx="46" ry="25" fill="#e7eeff"/>' +
    '<g transform="rotate(-8 60 42)"><rect x="37" y="21" width="46" height="42" rx="5" fill="#f3c94b" opacity=".35" transform="translate(2 3)"/>' +
    '<path d="M42 19h36a5 5 0 0 1 5 5v26l-12 12H42a5 5 0 0 1-5-5V24a5 5 0 0 1 5-5z" fill="#ffe9a3"/><path d="M71 62V55a5 5 0 0 1 5-5h7z" fill="#f5cf5a"/>' +
    '<path d="M46 31h26M46 38.5h22M46 46h14" stroke="#e0a10a" stroke-width="2.4" stroke-linecap="round"/></g>' +
    '<path d="M92 11l2.5-6M99 19l6.5-3M98 28h6" stroke="#1b5ef7" stroke-width="2.4" stroke-linecap="round"/></svg>';
  $("ver").title = "Page Notes v" + manifest.version;

  // ---------- Helpers ----------
  /**
   * Sends a message to the content script of the active tab (via the background worker).
   * @param {Object} payload - message for the tab
   * @returns {Promise<any>}
   */
  function toTab(payload) {
    return chrome.runtime.sendMessage({ type: "send-to-tab", tabId: tab.id, payload: payload });
  }
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
  /**
   * Opens a URL in a new tab and closes the popup.
   * @param {string} url - address to open
   */
  function openUrl(url) {
    chrome.tabs.create({ url: url });
    close();
  }

  // small SVG paths used on note cards (12x12 viewBox)
  var CARD_IC = {
    hl: '<path d="M2 10h8M3.5 7.8l4-4.6 1.8 1.6-4 4.5H3.5z"/>',
    el: '<rect x="1.8" y="1.8" width="8.4" height="8.4" rx="1" stroke-dasharray="1.6 1.3"/><circle cx="6" cy="6" r="1.3"/>',
    pin: '<path d="M6 10.8V7.2M3.6 7.2h4.8L7.6 5V2.2H4.4V5z"/>',
    link: '<path d="M5 7 7 5M4.2 5.6 3 6.8a1.7 1.7 0 0 0 2.4 2.4l1.2-1.2M7.8 6.4 9 5.2A1.7 1.7 0 0 0 6.6 2.8L5.4 4"/>',
    check: '<path d="M2.5 6.3 5 8.6l4.5-5.1"/>',
  };
  /**
   * Builds a small card icon.
   * @param {string} name - key in CARD_IC
   * @returns {HTMLElement}
   */
  function ic(name) {
    var sp = h("span", "ci");
    sp.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true">' + CARD_IC[name] + "</svg>"; // static markup only
    return sp;
  }
  /**
   * Flips a note between open and done, saved in storage.
   * @param {string} key - storage key of the page
   * @param {string} id - note id
   */
  function toggleDone(key, id) {
    chrome.storage.local.get(key, function (r) {
      var page = r[key];
      if (!page || !page.notes) return;
      var n = page.notes.filter(function (x) {
        return x.id === id;
      })[0];
      if (!n) return;
      n.done = !n.done;
      page.updatedAt = Date.now(); // note.updatedAt kept → the list order doesn't jump
      var o = {};
      o[key] = page;
      chrome.storage.local.set(o); // storage.onChanged → re-render
    });
  }
  // ---------- Note cards ----------
  // note card: [text (2 lines) · urgent · time] → highlighted quote → [type / site · done · links] + hover action
  /**
   * Builds one note card; clicking it focuses the note (this tab) or opens its page.
   * @param {Object} n - the note
   * @param {string} label - accessible label, e.g. "Note 01"
   * @param {Object|null} page - the note's page, or null for the active tab
   * @returns {HTMLElement}
   */
  function card(n, label, page) {
    var here = !page || PN.keyFor(page.url) === tabKey;
    var kind = n.hl ? "hl" : n.anchor ? "el" : "pin";
    var b = h("div", "card k-" + kind);
    b.tabIndex = 0;
    b.setAttribute("role", "button");
    b.style.setProperty("--c", n.color);
    if (n.done) b.setAttribute("data-done", "");

    var top = h("div", "c-top");
    var where = h("span", "c-where");
    if (here) {
      where.append(ic(kind), h("span", "", PN.t(kind === "hl" ? "hl" : kind === "el" ? "onEl" : "onPage")));
    } else {
      where.classList.add("site");
      where.append(siteIcon(PN.host(page.url), page.favicon), h("span", "", PN.host(page.url)));
    }
    var t = h("div", "txt rich");
    t.appendChild(PN.rich(n.text.trim() || PN.t("empty")));
    top.append(t);
    if (n.pri === "urgent") top.append(h("span", "c-urg", "! " + PN.t("urgent")));
    top.append(h("span", "c-time", PN.when(n.updatedAt)));
    b.append(top);

    if (n.hl || n.quote) b.append(h("div", "c-quote", (n.hl ? n.hl.text : n.quote).replace(/\s+/g, " ").trim()));

    var foot = h("div", "c-foot");
    foot.append(where);
    // status toggle: one click marks done / reopens (saved to storage → the page updates live)
    var st = h("button", n.done ? "c-st done" : "c-st open");
    st.type = "button";
    st.append(n.done ? ic("check") : h("i", "c-dot"), h("span", "", PN.t(n.done ? "done" : "open")));
    st.title = PN.t(n.done ? "reopen" : "markDone");
    st.setAttribute("aria-pressed", String(!!n.done));
    st.onclick = function (e) {
      e.stopPropagation();
      toggleDone(page ? PN.keyFor(page.url) : tabKey, n.id);
    };
    foot.append(st);
    var nl = PN.links(n.text).length;
    if (nl) {
      var l = h("span", "c-link");
      l.append(ic("link"), h("span", "", PN.tn("link1", "linkN", nl)));
      foot.append(l);
    }
    var go = h("span", "c-go");
    go.append(h("span", "c-go-t", here ? PN.t("showIt") : PN.t("openIt")), h("span", "c-go-a", here ? "→" : "↗"));
    foot.append(go);
    b.append(foot);

    b.title = label + " · " + (here ? PN.t("focusNote") : PN.t("openOn", { host: PN.host(page.url) }));
    b.onkeydown = function (e) {
      if ((e.key === "Enter" || e.key === " ") && e.target === b) {
        e.preventDefault();
        b.click();
      }
    };
    b.onclick = function (e) {
      if (e.target.closest("a, button")) return; // links + status toggle handle themselves
      if (here) {
        toTab({ type: "focus", id: n.id }).then(function () {
          close();
        });
      } else openUrl(PN.noteLink(page.url, n.id));
    };
    return b;
  }

  /**
   * Counts done notes.
   * @param {Array<Object>} notes - notes list
   * @returns {number}
   */
  function doneCount(notes) {
    return notes.filter(function (n) {
      return n.done;
    }).length;
  }
  // big number; -1 = not applicable ("--"), 0 is dimmed
  /**
   * Shows a big summary number.
   * @param {string} id - element id
   * @param {number} v - value (-1 = not applicable)
   */
  function num(id, v) {
    $(id).textContent = v < 0 ? "--" : PN.pad(v);
    $(id).classList.toggle("zero", v <= 0);
  }
  // "2 open · 1 done" under the number
  /**
   * Writes the open / done line under a summary number.
   * @param {string} subId - id of the text element
   * @param {string} barId - id of the progress bar (currently unused)
   * @param {number} count - total notes
   * @param {number} done - done notes
   * @param {string} emptyText - text shown when count is 0
   */
  function progress(subId, barId, count, done, emptyText) {
    var sub = $(subId);
    sub.textContent = "";
    if (!count) return (sub.textContent = emptyText);
    var open = count - done;
    if (open) sub.append(h("b", "", PN.t("nOpen", { n: open })));
    if (open && done) sub.append(" · ");
    if (done) sub.append(h("b", "g", PN.t("nDone", { n: done })));
  }

  // ---------- Empty states ----------
  // larger SVG paths for empty-state cards (20x20 viewBox)
  var ICONS = {
    note: '<path d="M4 3h12v9l-4 4H4z"/><path d="M12 16v-4h4"/><path d="M7 7h6M7 10h3"/>',
    lock: '<rect x="4" y="9" width="12" height="8" rx="1.5"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/><path d="M10 12.5v1.5"/>',
    filter: '<path d="M3 4h14l-5.5 6.5V16l-3-1.5v-4z"/>',
    spark: '<path d="M4 5h9v8l-3 3H4z"/><path d="M10 16v-3h3"/><path d="M16 2.5v3M14.5 4h3M17 9v2M16 10h2"/>',
  };
  // friendly empty / status card: icon · title · message · optional key hints · actions
  /**
   * Builds an empty / status card.
   * @param {Object} o - { icon | illus, tone, title, text, shortcuts?, keys?, actions? }
   * @returns {HTMLElement}
   */
  function emptyState(o) {
    var box = h("div", "state t-" + o.tone);
    if (o.illus) box.insertAdjacentHTML("beforeend", ILLUS); // static markup only
    else {
      var ic = h("span", "state-ic");
      ic.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true">' + ICONS[o.icon] + "</svg>"; // static markup only
      box.append(ic);
    }
    box.append(h("b", "", o.title), h("p", "", o.text));
    if (o.shortcuts) {
      // quick ways to highlight / stick to an element
      var sc = h("div", "state-sc");
      [["hl", "y", keys["place-highlight"]], ["el", "b", keys["place-element"]]].forEach(function (x) {
        var c = h("span", "sc sc-" + x[1]);
        var ic = h("span", "sc-ic");
        ic.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true">' + CARD_IC[x[0]] + "</svg>"; // static markup only
        c.append(ic, h("span", "", PN.t(x[0])));
        if (x[2]) c.append(h("kbd", "", x[2])); // only shortcuts the browser actually assigned
        sc.append(c);
      });
      box.append(sc);
    }
    if (o.keys) {
      var k = h("div", "state-keys");
      if (keys["place-note"]) k.append(h("kbd", "", keys["place-note"]));
      k.append(h("span", "", PN.t("kNew")), h("kbd", "", PN.t("kSel")), h("span", "", PN.t("kHl")));
      box.append(k);
    }
    var acts = (o.actions || []).filter(Boolean);
    if (acts.length) {
      var row = h("div", "state-acts");
      acts.forEach(function (a) {
        var b = h("button", a.primary ? (a.plus ? "btn new" : "btn") : "btn line");
        if (a.plus) b.innerHTML = PLUS; // static markup only
        b.append(h("span", "", a.label));
        b.type = "button";
        b.onclick = a.run;
        row.append(b);
      });
      box.append(row);
    }
    return box;
  }
  /** Asks the active tab to place a new free note, then closes the popup. */
  function placeNote() {
    toTab({ type: "place", mode: "free" }).then(function () { // the popup's button is always a plain note
      close();
    });
  }

  // ---------- Site dropdown ----------
  /**
   * Returns the site's favicon, or a letter badge when there is none or it fails to load.
   * @param {string} name - site host
   * @param {string} [favicon] - favicon URL
   * @returns {HTMLElement}
   */
  function siteIcon(name, favicon) {
    if (!favicon) return h("span", "gl", name ? name.charAt(0).toUpperCase() : "∗");
    var img = h("img");
    img.alt = "";
    img.src = favicon;
    img.onerror = function () {
      img.replaceWith(h("span", "gl", (name || "*").charAt(0).toUpperCase()));
    };
    return img;
  }
  // ---------- Tabs ----------
  var TABS = ["home", "notes", "sites"];
  /**
   * Shows one of the three tabs (Home / Notes / Sites).
   * @param {string} t - "home" | "notes" | "sites"
   */
  function setTab(t) {
    state.tab = t;
    TABS.forEach(function (x) {
      var on = x === t;
      $("tab-" + x).setAttribute("aria-selected", String(on));
      $("tab-" + x).tabIndex = on ? 0 : -1;
      $("p" + x.charAt(0).toUpperCase() + x.slice(1)).hidden = !on;
    });
  }

  // ---------- Site rows (Sites tab) ----------
  var GLOBE = '<svg class="i16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c2 1.8 3 3.8 3 6s-1 4.2-3 6c-2-1.8-3-3.8-3-6s1-4.2 3-6"/></svg>';
  var CHEV = '<svg class="i16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5"/></svg>';
  /**
   * Builds one site row; clicking it opens the Notes tab filtered to that site.
   * @param {Object} s - { host, count, done, pages, favicon }
   * @returns {HTMLElement}
   */
  function siteRow(s) {
    var b = h("button", "srow" + (s.host === tabHost ? " cur" : ""));
    b.type = "button";
    var ico = h("span", "sic");
    if (s.favicon) {
      var img = h("img");
      img.alt = "";
      img.src = s.favicon;
      img.onerror = function () {
        ico.innerHTML = GLOBE; // static markup only
      };
      ico.append(img);
    } else ico.innerHTML = GLOBE; // static markup only
    var txt = h("span", "st");
    var name = h("b");
    name.append(h("span", "", s.host));
    if (s.host === tabHost) name.append(h("i", "here", PN.t("curSite")));
    var sub = h("small", "", PN.tn("note1", "noteN", s.count) + " · " + PN.tn("onPage1", "onPageN", s.pages));
    var open = s.count - s.done;
    if (open) {
      sub.append(" · ");
      sub.append(h("b", "", PN.t("nOpen", { n: open })));
    }
    txt.append(name, sub);
    b.append(ico, txt);
    b.insertAdjacentHTML("beforeend", CHEV);
    b.title = PN.t("showRecentOn", { host: s.host });
    b.onclick = function () {
      state.domain = s.host;
      state.view = "site";
      state.quick = "all";
      setTab("notes");
      render(lastStore);
    };
    return b;
  }

  // ---------- Render ----------
  /**
   * Redraws the whole popup from a storage snapshot.
   * @param {Object} store - all of chrome.storage.local
   */
  function render(store) {
    lastStore = store;
    store.__ready = true;
    PN.setDev(store.settings && store.settings.dev); // inspect mode shows its own notes
    if (tab && tab.url) tabKey = PN.keyFor(tab.url);
    var pages = PN.allPages(store);
    // the Tip card is for new users: hidden once they have more than 10 notes on 2+ pages (Guides stay in All notes)
    var withNotes = pages.filter(function (p) {
      return p.notes && p.notes.length;
    });
    var noteSum = withNotes.reduce(function (a, p) {
      return a + p.notes.length;
    }, 0);
    $("guide").hidden = noteSum > 10 && withNotes.length > 1;
    var ok = !!(tab && PN.supported(tab.url));
    var page = ok ? store[tabKey] : null;
    var pageNotes = page && page.notes ? page.notes : [];

    // sites, newest activity first
    var sites = [];
    var byHost = {};
    var total = 0;
    pages.forEach(function (p) {
      var host = PN.host(p.url);
      total += p.notes.length;
      if (!byHost[host]) sites.push((byHost[host] = { host: host, count: 0, done: 0, pages: 0, favicon: p.favicon }));
      byHost[host].count += p.notes.length;
      byHost[host].done += doneCount(p.notes);
      byHost[host].pages += 1;
      if (!byHost[host].favicon && p.favicon) byHost[host].favicon = p.favicon;
    });

    if (state.domain === null) state.domain = ""; // every site by default
    if (state.domain && !byHost[state.domain]) state.domain = "";

    // numbers
    var siteName = state.domain || tabHost;
    var site = siteName && byHost[siteName] ? byHost[siteName] : { count: 0, done: 0, pages: 0 };
    num("nPage", ok ? pageNotes.length : -1);
    num("nSite", siteName ? site.count : -1);
    num("nAll", total);
    $("lSite").lastChild.textContent = siteName || PN.t("thisSite");
    $("sSite").title = siteName ? PN.t("showRecentOn", { host: siteName }) : PN.t("showRecent");
    var pageDone = doneCount(pageNotes);
    progress("dPage", "bPage", ok ? pageNotes.length : 0, pageDone, ok ? PN.t("none") : PN.t("na"));
    progress("dSite", "bSite", site.count, site.done, siteName ? PN.t("none") : PN.t("pick"));
    if (site.count) $("dSite").textContent = PN.tn("onPage1", "onPageN", site.pages);
    // tab counts: this page · every note · every site (always shown, 0 included)
    $("c-home").textContent = String(ok ? pageNotes.length : 0);
    $("c-notes").textContent = String(total);
    $("c-sites").textContent = String(sites.length);
    // "Show this page's notes": per page (page.hide), only when the page has notes
    $("show").checked = !(page && page.hide);
    $("show").disabled = !(ok && pageNotes.length);
    $("showLbl").style.opacity = $("show").disabled ? ".45" : "";
    if (!guideSet) {
      guideSet = true;
      // "How it works": full label for the first 3 opens (or until clicked), then just "?" (label on hover)
      var ui0 = store.ui || {};
      $("how").classList.toggle("full", !ui0.tourSeen && (ui0.opens || 0) < 3);
      ui0.opens = (ui0.opens || 0) + 1;
      chrome.storage.local.set({ ui: ui0 });
      // tips open as a floating panel above the tip card (never squeezes the list); click outside closes it
      document.addEventListener("click", function (e) {
        if ($("guide").open && !$("guide").contains(e.target)) $("guide").open = false;
      });
    }

    /**
     * Notes of all pages (or one host).
     * @param {string} filterHost - host to keep, "" for all
     * @returns {Array<Object>} { n, i, page } entries
     */
    function entries(filterHost) {
      var out = [];
      pages.forEach(function (p) {
        if (filterHost && PN.host(p.url) !== filterHost) return;
        p.notes.forEach(function (n, i) {
          out.push({ n: n, i: i, page: p });
        });
      });
      return out;
    }
    var pageEntries = pageNotes.map(function (n, i) {
      return { n: n, i: i, page: null };
    });
    // three linked lists for the Notes tab: recent (every site) · page (this page) · site (this / picked domain)
    var lists = {
      recent: entries(""),
      page: pageEntries,
      site: siteName ? entries(siteName) : [],
    };
    $("add").disabled = $("add2").disabled = $("add3").disabled = !ok;

    // ----- Home: this page's notes -----
    $("c-page").textContent = ok ? "(" + pageNotes.length + ")" : "";
    $("pageRow").hidden = !tab;
    var home = $("list");
    home.textContent = "";
    $("addRow").hidden = !(ok && pageNotes.length);
    var newBtn = { primary: true, plus: true, label: PN.t("newNote"), run: placeNote };
    if (!ok) home.appendChild(emptyState({ icon: "lock", tone: "n", title: PN.t("lockT"), text: PN.t("lockS") }));
    else if (!pageNotes.length) {
      home.appendChild(emptyState({ illus: true, tone: "b", title: total ? PN.t("emptyPageT") : PN.t("firstT"), text: PN.t("emptyPageX"), actions: [newBtn] }));
    } else {
      pageEntries
        .slice()
        .sort(function (a, b) {
          return (b.n.updatedAt || 0) - (a.n.updatedAt || 0);
        })
        .forEach(function (e) {
          home.appendChild(card(e.n, PN.t("note") + " " + PN.pad(e.i + 1), null));
        });
    }

    // ----- Notes tab -----
    [["recent", "c-recent"], ["page", "c-pg"], ["site", "c-site"]].forEach(function (x) {
      $("t-" + x[0]).setAttribute("aria-pressed", String(state.view === x[0]));
      $(x[1]).textContent = x[0] === "page" && !ok ? "" : String(lists[x[0]].length);
    });
    $("t-page").title = PN.t("pageTip");
    $("t-site").title = siteName ? PN.t("siteTip", { host: siteName }) : PN.t("pick");
    $("t-site").firstChild.textContent = siteName || PN.t("thisSite");
    $("t-recent").title = PN.t("recentTip");
    $("nTotal").textContent = PN.tn("notesTotal1", "notesTotalN", total);

    // search (text, quote, page title, host) → sort → quick filter
    var q = state.q.trim().toLowerCase();
    var base = lists[state.view].filter(function (e) {
      if (!q) return true;
      var p = e.page || page || {};
      return [e.n.text, e.n.quote, e.n.hl && e.n.hl.text, p.title, p.url && PN.host(p.url)].join(" ").toLowerCase().indexOf(q) > -1;
    });
    base.sort(function (a, b) {
      var d = (b.n.updatedAt || 0) - (a.n.updatedAt || 0);
      return state.sort === "old" ? -d : d;
    });
    // filter tests by quick-filter name
    var Q = {
      all: function () { return true; },
      open: function (e) { return !e.n.done; },
      done: function (e) { return e.n.done; },
      hl: function (e) { return !!e.n.hl; },
      links: function (e) { return PN.links(e.n.text).length > 0; },
      urgent: function (e) { return e.n.pri === "urgent"; },
    };
    $("quick").hidden = !base.length;
    Array.from($("quick").querySelectorAll("button")).forEach(function (btn) {
      var k = btn.getAttribute("data-q");
      btn.setAttribute("aria-pressed", String(state.quick === k));
      btn.querySelector("em").textContent = String(base.filter(Q[k]).length);
    });
    var shown = base.filter(Q[state.quick] || Q.all);

    var list = $("nlist");
    list.textContent = "";
    if (state.view === "page" && !ok) list.appendChild(emptyState({ icon: "lock", tone: "n", title: PN.t("lockT"), text: PN.t("lockS") }));
    else if (!total) list.appendChild(emptyState({ illus: true, tone: "b", title: PN.t("firstT"), text: PN.t("hint"), shortcuts: true }));
    else if (!base.length && q) list.appendChild(emptyState({ icon: "filter", tone: "n", title: PN.t("noMatch"), text: PN.t("noMatchX") }));
    else if (!base.length) list.appendChild(emptyState({ icon: "note", tone: "y", title: state.view === "page" ? PN.t("emptyPageT") : PN.t("siteEmpty"), text: PN.t("hint"), shortcuts: true }));
    else if (!shown.length) list.appendChild(emptyState({ icon: "filter", tone: "n", title: PN.t("noMatch"), text: PN.t("noMatchX") }));
    else {
      shown.slice(0, 30).forEach(function (e) {
        list.appendChild(card(e.n, PN.t("note") + " " + PN.pad(e.i + 1), e.page));
      });
      if (shown.length > 30) {
        var more = h("button", "link more", PN.t("more", { n: shown.length - 30 }) + " →");
        more.type = "button";
        more.onclick = openAll;
        list.appendChild(more);
      }
    }

    // ----- Sites tab -----
    sitesCache = sites;
    var sq = state.sq.trim().toLowerCase();
    var sl = $("slist");
    sl.textContent = "";
    var shownSites = sites.filter(function (s) {
      return !sq || s.host.toLowerCase().indexOf(sq) > -1;
    });
    if (!sites.length) sl.appendChild(emptyState({ illus: true, tone: "b", title: PN.t("noSites"), text: PN.t("sitesEmpty") }));
    else if (!shownSites.length) sl.appendChild(emptyState({ icon: "filter", tone: "n", title: PN.t("noMatch"), text: PN.t("noMatchX") }));
    else shownSites.forEach(function (s) {
      sl.appendChild(siteRow(s));
    });
    $("sTotal").textContent = PN.tn("sitesTotal1", "sitesTotalN", sites.length);
  }

  // ---------- Startup ----------
  // translate first (browser language or settings.lang), then load tab + data
  PN.initLang(function () {
    PN.langMenu($("langBtn"), $("langMenu"), $("langCode"));
    $("qNotes").placeholder = PN.t("searchNotes");
    $("qSites").placeholder = PN.t("searchSites");
    chrome.tabs.query({ active: true, currentWindow: true }, start);
    if (inPanel) {
      var reload = function () {
        chrome.tabs.query({ active: true, currentWindow: true }, start);
      };
      chrome.tabs.onActivated.addListener(reload);
      chrome.tabs.onUpdated.addListener(function (id, change) {
        if (tab && id === tab.id && (change.url || change.title || change.favIconUrl)) reload();
      });
    }
    chrome.storage.onChanged.addListener(function () {
      chrome.storage.local.get(null, render);
    });
  });
  /**
   * Reads the active tab, fills the header, then renders the data.
   * @param {Array<Object>} tabs - result of chrome.tabs.query
   */
  function start(tabs) {
    tab = tabs[0] || null;
    if (tab) {
      tabKey = tab.url ? PN.keyFor(tab.url) : "";
      tabHost = tab.url && PN.supported(tab.url) ? PN.host(tab.url) : "";
      $("title").textContent = tab.title || PN.t("thisTab");
      $("pageUrl").textContent = tab.url ? PN.normUrl(tab.url).replace(/^https?:\/\/(www\.)?/, "") : "";
      if (PN.supported(tab.url)) toTab({ type: "reveal" }).catch(function () {}); // "show notes when I open Page Notes"
      $("fav").style.display = "";
      if (tab.favIconUrl && /^https?:/.test(tab.favIconUrl)) $("fav").src = tab.favIconUrl;
      else $("fav").style.display = "none";
    }
    chrome.storage.local.get(null, render);
  }

  // ---------- Event handlers ----------
  /**
   * Opens the full "All my notes" page.
   * @param {Event} [e] - click event
   */
  function openAll(e) {
    if (e) e.preventDefault();
    var url = chrome.runtime.getURL("notes.html");
    // already open? switch to that tab (back to the notes view) instead of opening another one
    chrome.tabs.query({}, function (tabs) {
      var t = (tabs || []).filter(function (x) {
        return x.url && x.url.indexOf(url) === 0; // extension pages can't be matched with a URL pattern
      })[0];
      if (!t) return openUrl(url);
      chrome.tabs.update(t.id, { active: true, url: url });
      if (chrome.windows && t.windowId != null) chrome.windows.update(t.windowId, { focused: true });
      close();
    });
  }
  /**
   * Marks the tour as seen and opens the "How it works" page.
   * @param {Event} e - click event
   */
  function openHow(e) {
    e.preventDefault();
    var ui = lastStore.ui || {};
    ui.tourSeen = true;
    chrome.storage.local.set({ ui: ui }, function () {
      openUrl(HOW_URL);
    });
  }
  // (i) on the This page card only shows the page title + link; it does not open the card
  $("pageRow").onclick = function (e) {
    e.stopPropagation();
  };
  $("add").onclick = $("add2").onclick = $("add3").onclick = placeNote;
  /**
   * Switches the Notes-tab scope and resets the quick filter.
   * @param {string} v - "page" | "site" | "recent"
   */
  function setView(v) {
    state.view = v;
    state.quick = "all";
    render(lastStore);
  }
  // stat cards open the Notes tab on their scope (Everywhere = every note)
  // Everywhere / "View all" opens the full All notes page
  $("all").onclick = openAll;
  [["sPage", "page"], ["sSite", "site"]].forEach(function (x) {
    $(x[0]).onclick = function () {
      setTab("notes");
      setView(x[1]);
    };
  });
  // tabs: click, or arrow keys inside the tab bar
  TABS.forEach(function (t, i) {
    var b = $("tab-" + t);
    b.onclick = function () {
      setTab(t);
    };
    b.onkeydown = function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var step = (e.key === "ArrowRight") !== (document.dir === "rtl") ? 1 : -1;
      var next = TABS[(i + step + TABS.length) % TABS.length];
      setTab(next);
      $("tab-" + next).focus();
    };
  });
  setTab("home");
  $("qNotes").oninput = function () {
    state.q = this.value;
    render(lastStore);
  };
  // Sites search = combobox: type to filter, suggestions open below, Enter/click opens that site, × clears
  var sugAt = -1;
  /** Opens the Notes tab filtered to one site. @param {string} host */
  function openSite(host) {
    closeSug();
    state.domain = host;
    state.view = "site";
    state.quick = "all";
    setTab("notes");
    render(lastStore);
  }
  /** Hides the site suggestions. */
  function closeSug() {
    $("siteSug").hidden = true;
    $("qSites").setAttribute("aria-expanded", "false");
    sugAt = -1;
  }
  /** Fills + shows the suggestion list for the current search text. */
  function showSug() {
    var q = state.sq.trim().toLowerCase();
    var ul = $("siteSug");
    ul.textContent = "";
    var hits = sitesCache.filter(function (s) {
      return !q || s.host.toLowerCase().indexOf(q) > -1;
    });
    if (!sitesCache.length) return closeSug();
    if (!hits.length) ul.append(h("li", "none", PN.t("noMatch")));
    hits.slice(0, 8).forEach(function (s, i) {
      var li = h("li");
      var b = h("button");
      b.type = "button";
      b.setAttribute("role", "option");
      b.id = "sug-" + i;
      var nm = h("span", "nm");
      var at = q ? s.host.toLowerCase().indexOf(q) : -1;
      if (at > -1) nm.append(s.host.slice(0, at), h("mark", "", s.host.slice(at, at + q.length)), s.host.slice(at + q.length));
      else nm.textContent = s.host;
      b.append(siteIcon(s.host, s.favicon), nm, h("em", "", String(s.count)));
      b.onmousedown = function (e) {
        e.preventDefault(); // keep focus in the input
      };
      b.onclick = function () {
        openSite(s.host);
      };
      li.append(b);
      ul.append(li);
    });
    ul.hidden = false;
    $("qSites").setAttribute("aria-expanded", "true");
  }
  /** Moves the keyboard highlight in the suggestions. @param {number} d - +1 / -1 */
  function moveSug(d) {
    var items = Array.from($("siteSug").querySelectorAll("button"));
    if (!items.length) return;
    sugAt = (sugAt + d + items.length) % items.length;
    items.forEach(function (b, i) {
      b.classList.toggle("act", i === sugAt);
    });
    $("qSites").setAttribute("aria-activedescendant", items[sugAt].id);
  }
  $("qSites").oninput = function () {
    state.sq = this.value;
    $("qSitesClr").hidden = !this.value;
    render(lastStore);
    showSug();
  };
  $("qSites").onfocus = showSug;
  $("qSites").onblur = function () {
    setTimeout(closeSug, 120);
  };
  $("qSites").onkeydown = function (e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if ($("siteSug").hidden) showSug();
      moveSug(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter") {
      var items = $("siteSug").querySelectorAll("button");
      var pick = items[sugAt > -1 ? sugAt : 0];
      if (pick && !$("siteSug").hidden) {
        e.preventDefault();
        pick.click();
      }
    } else if (e.key === "Escape" && !$("siteSug").hidden) {
      e.preventDefault();
      e.stopPropagation();
      closeSug();
    }
  };
  $("qSitesClr").onclick = function () {
    $("qSites").value = "";
    state.sq = "";
    this.hidden = true;
    render(lastStore);
    $("qSites").focus();
  };
  $("sortSel").onchange = function () {
    state.sort = this.value;
    render(lastStore);
  };
  $("t-page").onclick = function () {
    setView("page");
  };
  $("t-site").onclick = function () {
    setView("site");
  };
  $("t-recent").onclick = function () {
    setView("recent");
  };
  // quick filter buttons (delegated)
  $("quick").onclick = function (e) {
    var b = e.target.closest("button[data-q]");
    if (!b) return;
    var k = b.getAttribute("data-q");
    state.quick = state.quick === k ? "all" : k; // click the active filter again to clear it
    render(lastStore);
  };
  $("allTop").onclick = openAll;
  $("how").onclick = openHow;
  $("how2").onclick = openHow;
  $("settings").onclick = function () {
    openUrl(chrome.runtime.getURL("notes.html#settings"));
  };
  // "Show this page's notes" toggle: saves page.hide for the active tab
  $("show").onchange = function (e) {
    chrome.storage.local.get(tabKey, function (r) {
      var pg = r[tabKey];
      if (!pg) return;
      if (e.target.checked) delete pg.hide;
      else pg.hide = true;
      pg.updatedAt = Date.now();
      var o = {};
      o[tabKey] = pg;
      chrome.storage.local.set(o);
    });
  };
})();
