/* Guetix Page Notes — toolbar popup: sites, counts, this page / recent notes + quick actions. */
(function () {
  var $ = function (id) {
    return document.getElementById(id);
  };
  var manifest = chrome.runtime.getManifest();
  var HOW_URL = (manifest.homepage_url || "https://guetix.com/components/page-notes-extension") + "#how-it-works";
  var tab = null;
  var tabKey = "";
  var tabHost = "";
  // view: "page" | "recent" · domain: "" = all sites. Picked once from the data, then user-driven.
  var state = { view: null, domain: null, quick: "all" };
  var lastStore = {};
  var guideSet = false;
  $("ver").textContent = "v" + manifest.version;
  $("ver").title = "Page Notes v" + manifest.version;

  function toTab(payload) {
    return chrome.runtime.sendMessage({ type: "send-to-tab", tabId: tab.id, payload: payload });
  }
  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function openUrl(url) {
    chrome.tabs.create({ url: url });
    window.close();
  }

  var CARD_IC = {
    hl: '<path d="M2 10h8M3.5 7.8l4-4.6 1.8 1.6-4 4.5H3.5z"/>',
    el: '<rect x="1.8" y="1.8" width="8.4" height="8.4" rx="1" stroke-dasharray="1.6 1.3"/><circle cx="6" cy="6" r="1.3"/>',
    pin: '<path d="M6 10.8V7.2M3.6 7.2h4.8L7.6 5V2.2H4.4V5z"/>',
    link: '<path d="M5 7 7 5M4.2 5.6 3 6.8a1.7 1.7 0 0 0 2.4 2.4l1.2-1.2M7.8 6.4 9 5.2A1.7 1.7 0 0 0 6.6 2.8L5.4 4"/>',
    check: '<path d="M2.5 6.3 5 8.6l4.5-5.1"/>',
  };
  function ic(name) {
    var sp = h("span", "ci");
    sp.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true">' + CARD_IC[name] + "</svg>"; // static markup only
    return sp;
  }
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
  // note card: [type / site · time] → text (2 lines) → highlighted quote → [done · links] + hover action
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
    top.append(where);
    if (n.pri === "urgent") top.append(h("span", "c-urg", "! " + PN.t("urgent")));
    top.append(h("span", "c-time", PN.when(n.updatedAt)));

    var t = h("div", "txt rich");
    t.appendChild(PN.rich(n.text.trim() || PN.t("empty")));
    b.append(top, t);

    if (n.hl || n.quote) b.append(h("div", "c-quote", (n.hl ? n.hl.text : n.quote).replace(/\s+/g, " ").trim()));

    var foot = h("div", "c-foot");
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
          window.close();
        });
      } else openUrl(PN.noteLink(page.url, n.id));
    };
    return b;
  }

  function doneCount(notes) {
    return notes.filter(function (n) {
      return n.done;
    }).length;
  }
  // big number; -1 = not applicable ("--"), 0 is dimmed
  function num(id, v) {
    $(id).textContent = v < 0 ? "--" : PN.pad(v);
    $(id).classList.toggle("zero", v <= 0);
  }
  // "2 open · 1 done" under the number
  function progress(subId, barId, count, done, emptyText) {
    var sub = $(subId);
    sub.textContent = "";
    if (!count) return (sub.textContent = emptyText);
    var open = count - done;
    if (open) sub.append(h("b", "", PN.t("nOpen", { n: open })));
    if (open && done) sub.append(" · ");
    if (done) sub.append(h("b", "g", PN.t("nDone", { n: done })));
  }

  var ICONS = {
    note: '<path d="M4 3h12v9l-4 4H4z"/><path d="M12 16v-4h4"/><path d="M7 7h6M7 10h3"/>',
    lock: '<rect x="4" y="9" width="12" height="8" rx="1.5"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/><path d="M10 12.5v1.5"/>',
    filter: '<path d="M3 4h14l-5.5 6.5V16l-3-1.5v-4z"/>',
    spark: '<path d="M4 5h9v8l-3 3H4z"/><path d="M10 16v-3h3"/><path d="M16 2.5v3M14.5 4h3M17 9v2M16 10h2"/>',
  };
  // friendly empty / status card: icon · title · message · optional key hints · actions
  function emptyState(o) {
    var box = h("div", "state t-" + o.tone);
    var ic = h("span", "state-ic");
    ic.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true">' + ICONS[o.icon] + "</svg>"; // static markup only
    box.append(ic, h("b", "", o.title), h("p", "", o.text));
    if (o.shortcuts) {
      // quick ways to highlight / stick to an element
      var sc = h("div", "state-sc");
      [["hl", "y", "Alt+Shift+L"], ["el", "b", "Alt+Shift+E"]].forEach(function (x) {
        var c = h("span", "sc sc-" + x[1]);
        var ic = h("span", "sc-ic");
        ic.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true">' + CARD_IC[x[0]] + "</svg>"; // static markup only
        c.append(ic, h("span", "", PN.t(x[0])), h("kbd", "", x[2]));
        sc.append(c);
      });
      box.append(sc);
    }
    if (o.keys) {
      var k = h("div", "state-keys");
      k.append(h("kbd", "", "Alt+Shift+N"), h("span", "", PN.t("kNew")), h("kbd", "", PN.t("kSel")), h("span", "", PN.t("kHl")));
      box.append(k);
    }
    var acts = (o.actions || []).filter(Boolean);
    if (acts.length) {
      var row = h("div", "state-acts");
      acts.forEach(function (a) {
        var b = h("button", a.primary ? "btn" : "btn line", a.label);
        b.type = "button";
        b.onclick = a.run;
        row.append(b);
      });
      box.append(row);
    }
    return box;
  }
  function placeNote() {
    toTab({ type: "place", mode: "free" }).then(function () { // the popup's button is always a plain note
      window.close();
    });
  }

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
  // site dropdown: button shows the selected site; menu lists All sites + every site with its count
  function siteMenu(sites, total) {
    var cur = state.domain ? sites.filter(function (s) { return s.host === state.domain; })[0] : null;
    var btn = $("siteBtn");
    btn.textContent = "";
    btn.append(siteIcon(state.domain, cur && cur.favicon), h("span", "nm", state.domain || PN.t("allSites")), h("em", "", String(cur ? cur.count : total)));
    btn.insertAdjacentHTML("beforeend", '<svg class="cv" viewBox="0 0 8 8" aria-hidden="true"><path d="M1.5 3 4 5.5 6.5 3"/></svg>');
    btn.disabled = !sites.length;
    btn.title = sites.length ? PN.tn("site1", "siteN", sites.length) : PN.t("sitesEmpty");
    var list = $("siteMenu");
    list.textContent = "";
    [{ host: "", count: total }].concat(sites).forEach(function (s, i) {
      var li = h("li", s.host ? "" : "all");
      var b = h("button");
      b.type = "button";
      b.setAttribute("role", "option");
      b.setAttribute("aria-selected", String(state.domain === s.host));
      b.append(siteIcon(s.host, s.favicon), h("span", "nm", s.host || PN.t("allSites")));
      if (s.host && s.host === tabHost) b.append(h("i", "here", PN.t("curSite")));
      b.append(h("em", "", String(s.count)));
      b.onclick = function () {
        state.domain = s.host;
        state.view = s.host ? "site" : "recent";
        closeSites();
        render(lastStore);
      };
      li.append(b);
      list.append(li);
      if (!i && sites.length) list.append(h("li", "sep"));
    });
  }
  function closeSites() {
    $("siteMenu").hidden = true;
    $("siteBtn").setAttribute("aria-expanded", "false");
  }

  function render(store) {
    lastStore = store;
    var pages = PN.allPages(store);
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

    if (state.domain === null) state.domain = ""; // Recent = every site by default
    if (state.domain && !byHost[state.domain]) state.domain = "";
    if (state.view === null) state.view = "page";

    siteMenu(sites, total);

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
      // tips open as a floating panel above the summary (never squeezes the list); click outside closes it
      document.addEventListener("click", function (e) {
        if ($("guide").open && !$("guide").contains(e.target)) $("guide").open = false;
      });
    }

    // three linked lists: page (this page) · site (this / picked domain) · recent (every site)
    function entries(filterHost) {
      var out = [];
      pages.forEach(function (p) {
        if (filterHost && PN.host(p.url) !== filterHost) return;
        p.notes.forEach(function (n, i) {
          out.push({ n: n, i: i, page: p });
        });
      });
      return out.sort(function (a, b) {
        return (b.n.updatedAt || 0) - (a.n.updatedAt || 0);
      });
    }
    var lists = {
      page: pageNotes.map(function (n, i) {
        return { n: n, i: i, page: null };
      }),
      site: siteName ? entries(siteName) : [],
      recent: entries(""),
    };

    ["page", "site", "recent"].forEach(function (v) {
      var on = String(state.view === v);
      $("t-" + v).setAttribute("aria-pressed", on);
      $("c-" + v).textContent = v === "page" && !ok ? "" : String(lists[v].length);
    });
    $("sPage").setAttribute("aria-pressed", String(state.view === "page"));
    $("sSite").setAttribute("aria-pressed", String(state.view === "site"));
    $("t-page").title = PN.t("pageTip");
    $("t-site").title = siteName ? PN.t("siteTip", { host: siteName }) : PN.t("pick");
    $("t-recent").title = PN.t("recentTip");
    $("pageRow").hidden = !tab;
    $("add").disabled = !ok;

    // quick filters (applied to the current list)
    var base = lists[state.view];
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
      var q = btn.getAttribute("data-q");
      btn.setAttribute("aria-pressed", String(state.quick === q));
      btn.querySelector("em").textContent = String(base.filter(Q[q]).length);
    });
    var shown = base.filter(Q[state.quick] || Q.all);

    var list = $("list");
    list.textContent = "";
    var firstRun = { icon: "spark", tone: "o", title: PN.t("firstT"), text: PN.t("hint"), shortcuts: true };
    if (state.view === "page" && !ok) return list.appendChild(emptyState({ icon: "lock", tone: "n", title: PN.t("lockT"), text: PN.t("lockS") }));
    if (!total) return list.appendChild(emptyState(firstRun));
    if (!base.length) {
      if (state.view === "page") return list.appendChild(emptyState({ icon: "note", tone: "y", title: PN.t("cleanT"), text: PN.t("hint"), shortcuts: true }));
      return list.appendChild(emptyState({ icon: "note", tone: "y", title: PN.t("siteEmpty"), text: PN.t("hint"), shortcuts: true }));
    }
    if (!shown.length) return list.appendChild(emptyState({ icon: "filter", tone: "n", title: PN.t("noMatch"), text: PN.t("noMatchX") }));
    shown.slice(0, 30).forEach(function (e) {
      list.appendChild(card(e.n, PN.t("note") + " " + PN.pad(e.i + 1), e.page));
    });
    if (shown.length > 30) {
      var more = h("button", "link plain", PN.t("more", { n: shown.length - 30 }) + " →");
      more.type = "button";
      more.style.justifySelf = "center";
      more.onclick = openAll;
      list.appendChild(more);
    }
  }

  // translate first (browser language or settings.lang), then load tab + data
  PN.initLang(function () {
    PN.langMenu($("langBtn"), $("langMenu"), $("langCode"));
    chrome.tabs.query({ active: true, currentWindow: true }, start);
    chrome.storage.onChanged.addListener(function () {
      chrome.storage.local.get(null, render);
    });
  });
  function start(tabs) {
    tab = tabs[0] || null;
    if (tab) {
      tabKey = tab.url ? PN.keyFor(tab.url) : "";
      tabHost = tab.url && PN.supported(tab.url) ? PN.host(tab.url) : "";
      $("title").textContent = tab.title || PN.t("thisTab");
      $("host").textContent = tab.url ? PN.host(tab.url) : "";
      if (PN.supported(tab.url)) toTab({ type: "reveal" }).catch(function () {}); // "show notes when I open Page Notes"
      if (tab.favIconUrl && /^https?:/.test(tab.favIconUrl)) $("fav").src = tab.favIconUrl;
      else $("fav").style.display = "none";
    }
    chrome.storage.local.get(null, render);
  }

  function openAll(e) {
    if (e) e.preventDefault();
    openUrl(chrome.runtime.getURL("notes.html"));
  }
  function openHow(e) {
    e.preventDefault();
    var ui = lastStore.ui || {};
    ui.tourSeen = true;
    chrome.storage.local.set({ ui: ui }, function () {
      openUrl(HOW_URL);
    });
  }
  $("siteBtn").onclick = function (e) {
    e.stopPropagation();
    var m = $("siteMenu");
    if (!m.hidden) return closeSites();
    m.hidden = false;
    this.setAttribute("aria-expanded", "true");
    var sel = m.querySelector("[aria-selected=true]");
    if (sel) sel.focus();
  };
  document.addEventListener("click", function (e) {
    if (!$("siteMenu").hidden && !$("siteMenu").contains(e.target)) closeSites();
  });
  $("siteMenu").addEventListener("keydown", function (e) {
    var items = Array.from(this.querySelectorAll("button"));
    var i = items.indexOf(document.activeElement);
    if (e.key === "Escape") {
      closeSites();
      $("siteBtn").focus();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
    }
  });
  $("add").onclick = placeNote;
  // Everywhere tile → the full All-notes dashboard (the Recent tab handles the in-popup list)
  $("all").onclick = openAll;
  function setView(v) {
    state.view = v;
    state.quick = "all";
    render(lastStore);
  }
  $("sSite").onclick = function () {
    setView("site");
  };
  $("sPage").onclick = function () {
    setView("page");
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
  $("quick").onclick = function (e) {
    var b = e.target.closest("button[data-q]");
    if (!b) return;
    state.quick = b.getAttribute("data-q");
    render(lastStore);
  };
  $("allTop").onclick = openAll;
  $("how").onclick = openHow;
  $("how2").onclick = openHow;
  $("settings").onclick = function () {
    openUrl(chrome.runtime.getURL("notes.html#settings"));
  };
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
