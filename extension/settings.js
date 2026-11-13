/* Guetix Page Notes — settings page: page behavior, shortcuts, data (export / import / delete), about. */
(function () {
  var $ = function (id) {
    return document.getElementById(id);
  };
  var manifest = chrome.runtime.getManifest();
  var store = {};
  // key → default when unset (content.js treats visible/snapshots as on unless === false)
  var TOGGLES = { visible: true, snapshots: true, tips: true, guide: true, undo: true };
  // option cards: setting -> default
  var CHOICES = { notesWhen: "auto", dock: "auto", guideMode: "full" };
  var KEY_LABELS = { "place-note": "cPlace", "place-element": "cEl", "place-highlight": "cHl", "toggle-notes": "cToggle", _execute_action: "cPopup" };

  $("ver").textContent = manifest.version;
  $("how").href = (manifest.homepage_url || "https://guetix.com/components/page-notes-extension") + "#how-it-works";

  var toastT;
  function say(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(toastT);
    toastT = setTimeout(function () {
      t.classList.remove("on");
    }, 2200);
  }
  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function size(b) {
    return b < 1024 ? b + " B" : b < 1048576 ? Math.round(b / 1024) + " KB" : (b / 1048576).toFixed(1) + " MB";
  }

  function render(s) {
    store = s;
    var settings = s.settings || {};
    Object.keys(TOGGLES).forEach(function (k) {
      $(k).checked = settings[k] === undefined ? TOGGLES[k] : !!settings[k];
    });
    // options that only matter while notes are shown on pages
    var on = settings.visible !== false;
    document.querySelectorAll("[data-dep=visible]").forEach(function (d) {
      d.classList.toggle("locked", !on);
    });
    if ($("depHint")) $("depHint").classList.toggle("on", !on);
    document.querySelectorAll(".opts").forEach(function (g) {
      var k = g.getAttribute("data-key");
      var cur = settings[k] || CHOICES[k];
      g.querySelectorAll(".opt").forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-val") === cur));
      });
    });
    var pages = PN.allPages(s);
    var notes = 0;
    var sites = {};
    pages.forEach(function (p) {
      notes += p.notes.length;
      sites[PN.host(p.url)] = 1;
    });
    $("sNotes").textContent = PN.pad(notes);
    $("sPages").textContent = PN.pad(pages.length);
    $("sSites").textContent = PN.pad(Object.keys(sites).length);
    chrome.storage.local.getBytesInUse(null, function (b) {
      $("sBytes").textContent = size(b || 0);
    });
  }
  function load() {
    chrome.storage.local.get(null, render);
  }
  // translate first, then load data + shortcuts
  PN.initLang(function () {
    PN.langPicker($("lang"));
    load();
    chrome.storage.onChanged.addListener(load);
    chrome.commands.getAll(renderKeys);
  });

  function saveSetting(k, v, msg) {
    chrome.storage.local.get("settings", function (r) {
      var s = r.settings || {};
      if (v === undefined) delete s[k];
      else s[k] = v;
      chrome.storage.local.set({ settings: s }, function () {
        say(msg || PN.t("saved"));
      });
    });
  }
  document.querySelectorAll(".opts").forEach(function (g) {
    g.addEventListener("click", function (e) {
      var b = e.target.closest(".opt");
      if (b) saveSetting(g.getAttribute("data-key"), b.getAttribute("data-val"));
    });
  });
  $("resetPos").onclick = function () {
    saveSetting("dockPos", undefined, PN.t("posReset"));
  };
  Object.keys(TOGGLES).forEach(function (k) {
    $(k).onchange = function (e) {
      chrome.storage.local.get("settings", function (r) {
        var s = r.settings || {};
        s[k] = e.target.checked;
        chrome.storage.local.set({ settings: s }, function () {
          say(PN.t("saved"));
        });
      });
    };
  });

  // shortcuts
  function renderKeys(cmds) {
    var box = $("keys");
    cmds.forEach(function (c) {
      var row = h("div", "row");
      var txt = h("span", "txt");
      txt.append(h("b", "", KEY_LABELS[c.name] ? PN.t(KEY_LABELS[c.name]) : c.description || c.name));
      row.append(txt, c.shortcut ? h("kbd", "", c.shortcut) : h("kbd", "none", PN.t("notSet")));
      box.append(row);
    });
  }
  $("editKeys").onclick = function () {
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  };

  // data
  $("export").onclick = function () {
    var pages = PN.allPages(store);
    var data = { app: "guetix-page-notes", version: 2, exportedAt: new Date().toISOString(), pages: pages };
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = "page-notes-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
    }, 2000);
    say(PN.t("exported"));
  };
  $("import").onclick = function () {
    $("file").click();
  };
  $("file").onchange = function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    f.text().then(function (txt) {
      e.target.value = "";
      var data;
      try {
        data = JSON.parse(txt);
      } catch (err) {
        return alert(PN.t("badJson"));
      }
      var pages = Array.isArray(data) ? data : data && data.pages;
      if (!Array.isArray(pages)) return alert(PN.t("noPages"));
      var o = {};
      var added = 0;
      pages.forEach(function (raw) {
        var p = PN.cleanPage(raw);
        if (!p || !p.notes.length) return;
        var k = PN.PREFIX + p.url;
        var cur = o[k] || store[k];
        var before = cur && cur.notes ? cur.notes.length : 0;
        if (cur && cur.notes) {
          var ids = new Set(cur.notes.map(function (n) { return n.id; }));
          p.notes = cur.notes.concat(p.notes.filter(function (n) { return !ids.has(n.id); }));
        }
        added += p.notes.length - before;
        o[k] = p;
      });
      chrome.storage.local.set(o, function () {
        say(PN.t("imported", { n: added }));
      });
    });
  };
  function keysWith(prefix) {
    return Object.keys(store).filter(function (k) {
      return k.indexOf(prefix) === 0;
    });
  }
  $("wipeShots").onclick = function () {
    var keys = keysWith(PN.SHOT);
    if (!keys.length) return say(PN.t("noShots"));
    if (confirm(PN.t("confShots", { n: keys.length }))) chrome.storage.local.remove(keys, function () { say(PN.t("shotsCleared")); });
  };
  $("wipe").onclick = function () {
    var keys = keysWith(PN.PREFIX).concat(keysWith(PN.SHOT));
    if (!keys.length) return say(PN.t("nothing"));
    if (confirm(PN.t("confWipe"))) chrome.storage.local.remove(keys, function () { say(PN.t("wiped")); });
  };
})();
