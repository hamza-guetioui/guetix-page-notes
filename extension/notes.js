/* Guetix Page Notes — "All my notes": every note from every page, as visual cards. */
(function () {
  var $ = function (id) {
    return document.getElementById(id);
  };
  var store = {};
  var state = { tab: "all", color: null, site: "", sort: "new", q: "" };
  var editing = null;
  var selecting = false;
  var picked = {}; // note id -> true
  var lastList = [];
  var TABS = [
    ["all", "All", ""],
    ["open", "Open", "o"],
    ["done", "Done", "g"],
    ["urgent", "Urgent", "r"],
    ["hl", "Highlights", "y"],
    ["links", "With links", "p"],
  ];

  // ---------- All notes | Settings (same page, #settings) ----------
  function route() {
    var st = location.hash === "#settings";
    document.body.setAttribute("data-view", st ? "settings" : "notes");
    $("navNotes").setAttribute("aria-pressed", String(!st));
    $("navSettings").setAttribute("aria-pressed", String(st));
    document.title = (st ? "Settings" : "All my notes") + " · Page Notes";
  }
  addEventListener("hashchange", route);
  $("navNotes").onclick = function () {
    history.replaceState(null, "", location.pathname);
    route();
  };
  $("navSettings").onclick = function () {
    location.hash = "settings";
  };
  route();
  $("verTop").textContent = "v" + chrome.runtime.getManifest().version;

  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  var toastT = 0;
  function say(t) {
    var el = $("toast");
    el.textContent = t;
    el.classList.add("on");
    clearTimeout(toastT);
    toastT = setTimeout(function () {
      el.classList.remove("on");
    }, 1800);
  }
  function kind(n) {
    return n.hl ? "Highlight" : n.anchor ? "Element" : "Free";
  }
  function path(url) {
    try {
      var u = new URL(url);
      return u.hostname.replace(/^www\./, "") + (u.pathname.length > 1 ? u.pathname : "") + u.search;
    } catch (e) {
      return url;
    }
  }

  /** Flat list of {page, note, i}. */
  function entries() {
    var out = [];
    PN.allPages(store).forEach(function (p) {
      p.notes.forEach(function (n, i) {
        out.push({ page: p, note: n, i: i });
      });
    });
    return out;
  }

  function open(page, note) {
    var go = function () {
      chrome.tabs.create({ url: page.url });
    };
    if (note) chrome.storage.local.set({ focus: { url: page.url, id: note.id, at: Date.now() } }, go);
    else go();
  }
  function savePage(page) {
    var k = PN.PREFIX + page.url;
    if (page.notes.length) {
      page.updatedAt = Date.now();
      var o = {};
      o[k] = page;
      chrome.storage.local.set(o);
    } else chrome.storage.local.remove(k);
  }
  function copy(text, msg) {
    navigator.clipboard.writeText(text).then(function () {
      say(msg);
    });
  }

  function matches(e, q) {
    var n = e.note;
    if (state.color && n.color !== state.color) return false;
    if (state.site && PN.host(e.page.url) !== state.site) return false;
    if (state.tab === "open" && n.done) return false;
    if (state.tab === "done" && !n.done) return false;
    if (state.tab === "urgent" && n.pri !== "urgent") return false;
    if (state.tab === "hl" && !n.hl) return false;
    if (state.tab === "links" && !PN.links(n.text).length) return false;
    if (!q) return true;
    return (n.text + " " + (n.quote || "") + " " + (n.hl ? n.hl.text : "") + " " + e.page.title + " " + e.page.url).toLowerCase().indexOf(q) > -1;
  }

  // ---------- card ----------
  function card(e, shots) {
    var p = e.page;
    var n = e.note;
    var c = h("article", "card");
    c.style.setProperty("--c", n.color);
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
    if (n.done) c.setAttribute("data-done", "");
    if (n.pri === "urgent") c.classList.add("urgent");
    // one small type tag next to the status (the site is in the page row below)
    var kindChip = n.hl ? h("span", "chip y", "▍Highlight") : n.anchor ? h("span", "chip b", "◎ Element") : null;

    var shot = h("a", "shot");
    shot.href = PN.noteLink(p.url, n.id);
    shot.title = "Open the page at this note";
    shot.onclick = function (ev) {
      ev.preventDefault();
      open(p, n);
    };
    var img = shots[PN.SHOT + n.id];
    if (img) {
      var im = h("img", "snap");
      im.alt = "Where this note sits on " + PN.host(p.url);
      im.loading = "lazy";
      im.src = img;
      shot.appendChild(im);
    } else {
      shot.classList.add("noimg");
      var ph = h("div", "ph");
      var fav = h("img");
      fav.alt = "";
      if (p.favicon) fav.src = p.favicon;
      else fav.style.display = "none";
      fav.onerror = function () {
        fav.style.display = "none";
      };
      // no snapshot: the slim colored header only carries the tags (the page title is in the row below)
    }
    var paper = h("span", "paper");
    paper.style.background = n.color;
    shot.append(paper, h("span", "chip dark open", "Open ↗"));
    if (img) c.appendChild(shot); // no snapshot → no empty header, the colour strip on top is enough

    var content = h("div", "content");
    var stbar = h("div", "stbar");
    // status: a two-option switch [Open | Done] — the filled one is the current status
    var st = h("div", "seg2");
    st.setAttribute("role", "radiogroup");
    st.setAttribute("aria-label", "Status");
    [["open", "Open"], ["done", "✓ Done"]].forEach(function (o) {
      var b = h("button", "s-" + o[0], o[1]);
      b.type = "button";
      b.setAttribute("role", "radio");
      var on = (o[0] === "done") === !!n.done;
      b.setAttribute("aria-checked", String(on));
      b.title = on ? "Current status" : o[0] === "done" ? "Mark as done" : "Reopen";
      b.onclick = function () {
        if (on) return;
        n.done = o[0] === "done"; // status change keeps the date → the list order stays the same
        savePage(p);
        say(n.done ? "Marked as done" : "Reopened");
      };
      st.append(b);
    });
    stbar.append(st);
    if (kindChip) stbar.append(kindChip);
    if (n.pri === "urgent") c.appendChild(h("span", "ubadge", "! URGENT"));
    stbar.append(h("small", "", PN.when(n.updatedAt || n.createdAt)));
    content.appendChild(stbar);
    var txt = h("div", "txt", n.text.trim() || "(empty note)"); // plain, static text — edit with the Edit button
    content.appendChild(txt);
    if (n.hl || n.quote) {
      var q = h("div", "q");
      q.appendChild(PN.rich((n.hl ? n.hl.text : "on " + n.quote).replace(/\s+/g, " ").trim(), state.q));
      content.appendChild(q);
    }
    c.appendChild(content);

    var pg = h("div", "pg");
    var pa = h("a");
    pa.href = p.url;
    pa.target = "_blank";
    pa.rel = "noopener";
    pa.title = p.url;
    var fv = h("img");
    fv.alt = "";
    if (p.favicon) fv.src = p.favicon;
    else fv.style.display = "none";
    fv.onerror = function () {
      fv.style.display = "none";
    };
    var pt = h("span");
    pt.append(h("b", "", p.title || PN.host(p.url)), h("small", "", path(p.url)));
    pa.append(fv, pt);
    var go = h("button", "ico", "→");
    go.type = "button";
    go.title = "Show this note on its page";
    go.setAttribute("aria-label", "Show this note on its page");
    go.onclick = function () {
      open(p, n);
    };
    pg.append(pa, go);
    c.appendChild(pg);

    var acts = h("div", "acts");
    var AI = {
      "a-link": '<path d="M6.7 9.3 9.3 6.7M5.6 7.5 4 9.1a2.3 2.3 0 0 0 3.2 3.2l1.6-1.6M10.4 8.5 12 6.9a2.3 2.3 0 0 0-3.2-3.2L7.2 5.3"/>',
      "a-edit": '<path d="M10.5 3 13 5.5 6 12.5H3.5V10z"/>',
      "a-del": '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9"/>',
    };
    var act = function (label, fn, pressed, cls) {
      var b = h("button", cls || "");
      b.insertAdjacentHTML("beforeend", '<svg viewBox="0 0 16 16" aria-hidden="true">' + (AI[cls] || "") + "</svg>"); // static markup only
      b.append(label);
      b.type = "button";
      if (pressed != null) b.setAttribute("aria-pressed", String(pressed));
      b.onclick = fn;
      acts.appendChild(b);
      return b;
    };
    var cl = act("Copy link", function () {
      navigator.clipboard.writeText(PN.noteLink(p.url, n.id)).then(
        function () {
          cl.classList.add("ok");
          cl.lastChild.textContent = "\u2713 Copied";
          say("Link to this note copied");
          setTimeout(function () {
            cl.classList.remove("ok");
            cl.lastChild.textContent = "Copy link";
          }, 1600);
        },
        function () {
          say("Couldn't copy - clipboard blocked");
        },
      );
    }, null, "a-link");
    act("Edit", function () {
      openEditor(p, n);
    }, null, "a-edit");
    act("Delete", function () {
      askDelete(1, function () {
        p.notes = p.notes.filter(function (x) {
          return x.id !== n.id;
        });
        chrome.storage.local.remove(PN.SHOT + n.id);
        savePage(p);
        say("Note deleted");
      });
    }, null, "a-del");
    c.appendChild(acts);
    return c;
  }

  // ---------- editor: the note as a sticky note, like on the page ----------
  var ed = null;
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
  function paintEditor() {
    $("edNote").style.background = ed.color;
    Array.prototype.forEach.call($("edDots").children, function (b, i) {
      b.setAttribute("aria-pressed", String(PN.COLORS[i] === ed.color));
    });
    $("edUrg").setAttribute("aria-pressed", String(ed.urgent));
    $("edDone").setAttribute("aria-pressed", String(ed.done));
  }
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

    // live counts per tab (same site / color / search scope)
    var keep = state.tab;
    TABS.forEach(function (t) {
      state.tab = t[0];
      var c = all.filter(function (e) {
        return matches(e, q);
      }).length;
      tabBtns[t[0]].querySelector("em").textContent = String(c);
      tabBtns[t[0]].classList.toggle("zero", !c && t[0] !== "all");
      tabBtns[t[0]].hidden = t[0] === "urgent" && !c && keep !== "urgent";
    });
    state.tab = keep;
    $("clearF").hidden = !(state.site || state.color || q || state.tab !== "all");
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
    if (!all.length) {
      var w = h("div", "hello");
      w.append(h("span", "mark"), h("h2", "", "Your notes will live here"), h("p", "", "Pin sticky notes on any website — everything you pin shows up in this list."));
      var ol = h("ol");
      [["Alt+Shift+N", "Open any website and press the shortcut (or use the toolbar icon)."], ["Click", "Click anywhere on the page to pin a note."], ["Alt+Shift+L", "Select text to highlight it with a note."]].forEach(function (x) {
        var li = h("li");
        li.append(h("kbd", "", x[0]), h("span", "", x[1]));
        ol.append(li);
      });
      w.append(ol);
      return grid.appendChild(w);
    }
    if (!list.length) {
      grid.appendChild(h("div", "empty", "Nothing matches these filters."));
      grid.firstChild.style.gridColumn = "1/-1";
      return;
    }
    lastList = list;
    var shots = store;
    list.forEach(function (e) {
      grid.appendChild(card(e, shots));
    });
  }

  // ---------- controls ----------
  var tabBtns = {};
  TABS.forEach(function (t) {
    var b = h("button", "tab");
    if (t[2]) b.appendChild(h("span", "dot " + t[2]));
    b.append(t[1], h("em", "", "0"));
    tabBtns[t[0]] = b;
    b.type = "button";
    b.setAttribute("aria-pressed", String(t[0] === state.tab));
    b.onclick = function () {
      state.tab = t[0];
      Array.prototype.forEach.call($("tabs").children, function (x) {
        x.setAttribute("aria-pressed", String(x === b));
      });
      render();
    };
    $("tabs").appendChild(b);
  });
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
    state.tab = "all";
    $("q").value = "";
    Array.prototype.forEach.call($("tabs").children, function (x, i) {
      x.setAttribute("aria-pressed", String(i === 0));
    });
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
  snav.onclick = function (e) {
    var b = e.target.closest("button[data-to]");
    if (!b) return;
    var sec = $(b.getAttribute("data-to")).closest("section");
    sec.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  if (window.IntersectionObserver) {
    var io = new IntersectionObserver(
      function (ents) {
        ents.forEach(function (en) {
          if (!en.isIntersecting) return;
          var id = en.target.querySelector("h2").id;
          Array.prototype.forEach.call(snav.children, function (x) {
            x.setAttribute("aria-current", String(x.getAttribute("data-to") === id));
          });
        });
      },
      { rootMargin: "-80px 0px -60% 0px" },
    );
    document.querySelectorAll("#vSettings section").forEach(function (sec) {
      io.observe(sec);
    });
  }
  $("sort").onchange = function (e) {
    state.sort = e.target.value;
    render();
  };
  $("q").oninput = function (e) {
    state.q = e.target.value;
    render();
  };
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement === document.body) {
      e.preventDefault();
      $("q").focus();
    }
  });

  // ---------- select + share ----------
  function selected() {
    return lastList.filter(function (e) {
      return picked[e.note.id];
    });
  }
  function updateShare() {
    var n = selected().length;
    $("selN").textContent = String(n);
    ["shMenuBtn", "bDone", "bOpen", "bUrg", "bDel"].forEach(function (id) {
      $(id).disabled = !n;
    });
  }
  function setSelecting(v) {
    selecting = v;
    if (!v) picked = {};
    $("vNotes").classList.toggle("selecting", v);
    $("selBtn").setAttribute("aria-pressed", String(v));

    render();
    updateShare();
  }
  /** Selected notes as readable Markdown, grouped by page. */
  function asText() {
    var byPage = {};
    var order = [];
    selected().forEach(function (e) {
      if (!byPage[e.page.url]) {
        byPage[e.page.url] = { page: e.page, notes: [] };
        order.push(e.page.url);
      }
      byPage[e.page.url].notes.push(e.note);
    });
    var out = ["# Page Notes", ""];
    order.forEach(function (u) {
      var g = byPage[u];
      out.push("## " + (g.page.title || PN.host(u)), u, "");
      g.notes.forEach(function (n) {
        var line = "- " + (n.done ? "[x] " : "[ ] ") + (n.pri === "urgent" ? "**URGENT** " : "") + (n.text.trim() || "(empty note)").replace(/\n/g, "\n  ");
        if (n.hl) line += "\n  > " + n.hl.text.replace(/\s+/g, " ").trim();
        out.push(line);
      });
      out.push("");
    });
    return out.join("\n");
  }
  function fileName() {
    return "page-notes-" + new Date().toISOString().slice(0, 10) + ".md";
  }
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
  function openSheet() {
    var text = asText();
    var short = text.length > 1800 ? text.slice(0, 1800) + "\n…" : text;
    var enc = encodeURIComponent(short);
    var apps = $("apps");
    apps.textContent = "";
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
  function closeSheet() {
    $("sheet").classList.remove("on");
  }
  $("selBtn").onclick = function () {
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
  var onConfirm = null;
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
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if ($("editor").classList.contains("on")) closeEditor(false);
      else if ($("confirm").classList.contains("on")) $("confirm").classList.remove("on");
      else if ($("sheet").classList.contains("on")) closeSheet();
      else if (selecting) setSelecting(false);
    }
  });

  function refresh() {
    chrome.storage.local.get(null, function (s) {
      store = s;
      render();
    });
  }
  chrome.storage.onChanged.addListener(refresh);
  refresh();
})();
