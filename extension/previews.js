/* Guetix Page Notes — settings previews.
 *
 * Overview:
 * - Adds a "Preview" button to each setting row in the Settings view (#vSettings) and an inline panel under it.
 * - The panel shows a mini mock browser page that plays what the setting does (Web Animations API),
 *   a segmented toggle to compare cases (without changing the real setting) and a Replay button.
 * - Only reads the DOM (switch .checked, option cards aria-pressed); settings.js stays the only writer.
 * - Animations play once and stop on the end state; prefers-reduced-motion shows the end state at once.
 */
(function () {
  var root = document.getElementById("vSettings");
  if (!root || !root.animate) return;
  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var SVGNS = "http://www.w3.org/2000/svg";
  var POP = "cubic-bezier(.34,1.56,.64,1)";
  var EASE = "cubic-bezier(.3,.7,.2,1)";
  var MOVE = "cubic-bezier(.45,.05,.25,1)";
  // the user's real "New note" shortcut (e.g. "Ctrl+Shift+Y"); "" = not set / unknown
  var SHORTCUT = "";
  if (window.chrome && chrome.commands && chrome.commands.getAll)
    chrome.commands.getAll(function (list) {
      (list || []).forEach(function (c) {
        if (c.name === "place-note") SHORTCUT = c.shortcut || "";
      });
    });
  /** Key cap labels for the shortcut: "Ctrl+Shift+Y" -> ["Ctrl","Shift","Y"], mac "⌘⇧Y" -> ["⌘","⇧","Y"]. */
  function shortcutKeys() {
    if (!SHORTCUT) return ["Shortcut"];
    return SHORTCUT.indexOf("+") >= 0 ? SHORTCUT.split("+") : Array.from(SHORTCUT);
  }

  /**
   * Create an element with an optional class and text.
   * @param {string} tag - tag name
   * @param {string} cls - class name (optional)
   * @param {string} text - text content (optional)
   * @returns {HTMLElement}
   */
  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  /**
   * Create a small inline SVG icon from path data.
   * @param {string} d - path data
   * @param {string} vb - viewBox (default "0 0 16 16")
   * @returns {SVGElement}
   */
  function icon(d, vb) {
    var s = document.createElementNS(SVGNS, "svg");
    s.setAttribute("viewBox", vb || "0 0 16 16");
    s.setAttribute("aria-hidden", "true");
    var p = document.createElementNS(SVGNS, "path");
    p.setAttribute("d", d);
    s.append(p);
    return s;
  }
  /**
   * Place an element absolutely with a style object.
   * @param {HTMLElement} el - element
   * @param {Object} st - css properties
   * @returns {HTMLElement}
   */
  function at(el, st) {
    Object.keys(st).forEach(function (k) {
      el.style[k] = st[k];
    });
    return el;
  }

  // ---------- timeline ----------
  /**
   * Collects keyframes per element + property on one shared clock, then plays them as single animations
   * (one animation per track, so later steps never override earlier ones).
   * @param {HTMLElement} win - the mock window (coordinates are relative to it)
   */
  function Scene(win) {
    this.win = win;
    this.tracks = [];
    this.end = 0;
    this.wr = win.getBoundingClientRect();
    this.w = this.wr.width;
  }
  /** Add a keyframe: element el has css prop = v at time t (ms); ease applies to the segment after it. */
  Scene.prototype.key = function (el, prop, t, v, ease) {
    var tr = null;
    for (var i = 0; i < this.tracks.length; i++) if (this.tracks[i].el === el && this.tracks[i].prop === prop) tr = this.tracks[i];
    if (!tr) this.tracks.push((tr = { el: el, prop: prop, keys: [] }));
    tr.keys.push({ t: t, v: v, e: ease || EASE });
    if (t > this.end) this.end = t;
    return this;
  };
  /** Center of an element, relative to the mock window. */
  Scene.prototype.pos = function (el) {
    var r = el.getBoundingClientRect();
    return { x: r.left - this.wr.left + r.width / 2, y: r.top - this.wr.top + r.height / 2, w: r.width, h: r.height, l: r.left - this.wr.left, t: r.top - this.wr.top };
  };
  /** Fade + pop an element in at time t. */
  Scene.prototype.pop = function (el, t, from) {
    this.key(el, "opacity", t, 0).key(el, "opacity", t + 200, 1);
    return this.key(el, "transform", t, from || "scale(.6)", POP).key(el, "transform", t + 380, "none");
  };
  /** Slide an element up into place at time t. */
  Scene.prototype.slide = function (el, t) {
    return this.pop(el, t, "translateY(14px)");
  };
  /** Fade an element out at time t. */
  Scene.prototype.fade = function (el, t, dur) {
    return this.key(el, "opacity", t, 1).key(el, "opacity", t + (dur || 250), 0);
  };
  /** Add the cursor at x, y (fades in). */
  Scene.prototype.cursor = function (x, y) {
    var c = h("div", "pv-cur");
    var s = icon("M1 1v14.5l4-3.8 2.6 6 2.4-1-2.6-5.9H13z", "0 0 16 20");
    c.append(s);
    this.win.append(c);
    this.c = c;
    this.cx = x;
    this.cy = y;
    this.follow = [];
    this.key(c, "transform", 0, tf(x, y, 1)).key(c, "opacity", 0, 0).key(c, "opacity", 200, 1);
    return c;
  };
  /**
   * Move the cursor (and anything following it) to an element's center or to a point.
   * @returns {number} time when the move ends
   */
  Scene.prototype.move = function (to, t, dur) {
    var p = to.nodeType ? this.pos(to) : to;
    this.key(this.c, "transform", t, tf(this.cx, this.cy, this.s || 1), MOVE).key(this.c, "transform", t + dur, tf(p.x, p.y, this.s || 1));
    for (var i = 0; i < this.follow.length; i++) {
      var f = this.follow[i];
      this.key(f.el, "transform", t, tl(this.cx + f.ox, this.cy + f.oy), MOVE).key(f.el, "transform", t + dur, tl(p.x + f.ox, p.y + f.oy));
    }
    this.cx = p.x;
    this.cy = p.y;
    return t + dur;
  };
  /** Press (scale down) or release the cursor at time t. */
  Scene.prototype.press = function (t, down) {
    this.s = down ? 0.82 : 1;
    this.key(this.c, "transform", t, tf(this.cx, this.cy, down ? 1 : 0.82)).key(this.c, "transform", t + 90, tf(this.cx, this.cy, this.s));
    if (down) this.ring(this.cx, this.cy, t);
  };
  /** Click at the cursor position at time t. */
  Scene.prototype.click = function (t) {
    this.press(t, true);
    this.press(t + 110, false);
    return t + 200;
  };
  /** Expanding ring at x, y at time t. */
  Scene.prototype.ring = function (x, y, t, big) {
    var r = at(h("i", "pv-ring" + (big ? " big" : "")), { left: x + "px", top: y + "px" });
    this.win.append(r);
    this.key(r, "opacity", t, 0).key(r, "opacity", t + 30, 0.9).key(r, "opacity", t + 480, 0);
    this.key(r, "transform", t, "scale(.3)").key(r, "transform", t + 480, "scale(1.5)");
  };
  /** Make el follow the cursor (offset ox, oy), appearing at time t. */
  Scene.prototype.attach = function (el, ox, oy, t) {
    this.follow.push({ el: el, ox: ox, oy: oy });
    this.key(el, "transform", t, tl(this.cx + ox, this.cy + oy));
    this.key(el, "opacity", t, 0).key(el, "opacity", t + 160, 1);
  };
  /**
   * Turn every track into one animation over the whole timeline.
   * @param {boolean} instant - jump to the end state (reduced motion)
   */
  Scene.prototype.commit = function (instant) {
    var T = this.end + 200;
    this.tracks.forEach(function (tr) {
      var frames = tr.keys
        .slice()
        .sort(function (a, b) {
          return a.t - b.t;
        })
        .map(function (k) {
          var f = { offset: k.t / T, easing: k.e };
          f[tr.prop] = k.v;
          return f;
        });
      var first = frames[0];
      var last = frames[frames.length - 1];
      if (first.offset > 0) frames.unshift(Object.assign({}, first, { offset: 0 }));
      if (last.offset < 1) frames.push(Object.assign({}, last, { offset: 1 }));
      var a = tr.el.animate(frames, { duration: T, fill: "both" });
      if (instant) a.finish();
    });
  };
  /** translate + scale transform (same function list so steps interpolate). */
  function tf(x, y, s) {
    return "translate(" + x + "px," + y + "px) scale(" + s + ")";
  }
  /** translate-only transform. */
  function tl(x, y) {
    return "translate(" + x + "px," + y + "px)";
  }

  // ---------- mock page parts ----------
  var LINES = [
    [14, 38, "h"],
    [32, 54],
    [44, 48],
    [56, 52],
    [76, 44],
    [88, 56],
    [100, 40],
    [112, 50],
  ];
  /**
   * Build the mini browser window in the stage.
   * @param {HTMLElement} stage - container
   * @param {Object} opt - { lines: false } for an empty page
   * @returns {{win: HTMLElement, page: HTMLElement, ext: HTMLElement, lines: Array<HTMLElement>}}
   */
  function mock(stage, opt) {
    stage.textContent = "";
    var win = h("div", "pv-win");
    var bar = h("div", "pv-bar");
    bar.append(h("i"), h("i"), h("i"), h("span", "pv-url", "example.com/article"));
    var ext = h("span", "pv-ext");
    ext.title = "Page Notes";
    bar.append(ext);
    var page = h("div", "pv-page");
    var lines = [];
    (opt && opt.lines === false ? LINES.slice(0, 1) : LINES).forEach(function (l) {
      var n = at(h("i", "pv-ln" + (l[2] ? " " + l[2] : "")), { top: l[0] + "px", width: l[1] + "%" });
      page.append(n);
      lines.push(n);
    });
    win.append(bar, page);
    stage.append(win);
    return { win: win, page: page, ext: ext, lines: lines };
  }
  /** Page "loads": lines fade in one after another. */
  function load(m, S) {
    m.lines.forEach(function (l, i) {
      S.key(l, "opacity", i * 45, 0).key(l, "opacity", i * 45 + 260, 1);
    });
  }
  /**
   * A sticky note.
   * @param {HTMLElement} parent - where to add it
   * @param {string} cls - extra classes ("p", "b", "big", "ghost")
   * @param {Object} st - position styles
   * @param {number} n - number of text lines
   */
  function note(parent, cls, st, n) {
    var el = at(h("div", "pv-note" + (cls ? " " + cls : "")), st);
    for (var i = 0; i < (n == null ? 3 : n); i++) el.append(h("b"));
    parent.append(el);
    return el;
  }
  /** The on-page toolbar: mascot + "+ Note" (or only the mascot when mini). */
  function toolbar(parent, mini) {
    var el = h("div", "pv-tb" + (mini ? " mini" : ""));
    var mas = h("span", "pv-mas");
    el.append(mas);
    var add = null;
    if (!mini) {
      add = h("span", "pv-add", "+ Note");
      el.append(add);
    }
    parent.append(el);
    return { el: el, mas: mas, add: add };
  }
  /** A centered pill message on the page. */
  function badge(parent, text, st, d) {
    var el = at(h("div", "pv-badge"), st || { top: "52px" });
    if (d) el.append(icon(d));
    el.append(h("span", "", text));
    parent.append(el);
    return el;
  }
  /** The placing guide card. */
  function guide(parent) {
    var el = h("div", "pv-guide");
    el.append(h("b", "", "Place your note"), h("span", "", "Click anywhere on the page"));
    var steps = h("div", "pv-steps");
    steps.append(h("i", "on"), h("i"), h("i"));
    el.append(steps);
    parent.append(el);
    return el;
  }
  var CAMERA = "M2.5 5.5A1 1 0 0 1 3.5 4.5h1.8l1-1.5h3.4l1 1.5h1.8a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1zM8 10.6a2.1 2.1 0 1 0 0-4.2 2.1 2.1 0 0 0 0 4.2z";
  var EYE_OFF = "M2 2l12 12M6.5 6.6A2 2 0 0 0 9.4 9.5M4.2 4.4C2.5 5.6 1.5 8 1.5 8s2.5 5 6.5 5c1.4 0 2.6-.5 3.6-1.2M7 3.1c.3 0 .7-.1 1-.1 4 0 6.5 5 6.5 5s-.5 1-1.4 2.1";

  // ---------- one scene per setting ----------
  /**
   * Shared "place a note" storyboard: click + Note, ghost note follows the cursor, click to drop.
   * @param {string} mode - "full" (guide card), "compact" ("?" then card) or "none"
   */
  function placing(m, S, mode) {
    var tb = toolbar(m.page);
    var card = mode !== "none" ? guide(m.page) : null;
    var q = mode === "compact" ? m.page.appendChild(h("span", "pv-q", "?")) : null;
    S.cursor(S.w * 0.5, 50);
    var t = S.move(tb.add, 150, 700);
    t = S.click(t + 60);
    var ghost = note(m.win, "ghost", { left: "0", top: "0" }, 0);
    S.attach(ghost, 6, 8, t + 80);
    if (mode === "full") S.pop(card, t + 120);
    if (q) {
      S.pop(q, t + 120);
      t = S.move(q, t + 450, 600);
      t = S.click(t + 50);
      S.fade(q, t + 40, 160);
      S.pop(card, t + 80);
      t += 300;
    }
    var dest = { x: S.w * 0.3, y: 66 };
    t = S.move(dest, t + 250, 900);
    t = S.click(t + 80);
    var placed = note(m.win, "", { left: dest.x + 6 + "px", top: dest.y + 8 + "px" });
    S.key(ghost, "opacity", t, 1).key(ghost, "opacity", t + 120, 0);
    S.pop(placed, t);
  }

  var P = {
    visible: {
      cases: [
        { key: "on", label: "On", caption: "Your notes show up on every page you saved them on." },
        { key: "off", label: "Off", caption: "Every note is hidden at once — nothing is deleted." },
      ],
      play: function (m, S, k) {
        load(m, S);
        if (k === "on") {
          S.pop(note(m.page, "", { left: "50%", top: "16px" }), 650);
          S.pop(note(m.page, "p", { left: "24%", top: "64px" }), 900);
          S.slide(toolbar(m.page).el, 1200);
        } else {
          S.pop(badge(m.page, "Notes are kept, just hidden", null, EYE_OFF), 900);
        }
      },
    },
    notesWhen: {
      cases: [
        { key: "auto", label: "Right away", caption: "Notes appear as soon as the page opens." },
        { key: "click", label: "When I open Page Notes", caption: "The page stays clean until you click the Page Notes icon." },
      ],
      play: function (m, S, k) {
        load(m, S);
        var a = note(m.page, "", { left: "50%", top: "16px" });
        var b = note(m.page, "b", { left: "24%", top: "64px" });
        var t = 500;
        if (k === "click") {
          S.cursor(S.w * 0.55, 120);
          t = S.move(m.ext, 450, 800);
          t = S.click(t + 60) + 150;
        }
        S.pop(a, t);
        S.pop(b, t + 220);
        S.slide(toolbar(m.page).el, t + 450);
      },
    },
    autoMin: {
      cases: [
        { key: "on", label: "On", caption: "Click outside a note with text and it folds into a small tab." },
        { key: "off", label: "Off", caption: "The note stays open after you click away." },
      ],
      play: function (m, S, k) {
        var n = note(m.page, "big", { left: "44%", top: "18px" });
        var tab = n.appendChild(h("span", "pv-nt", "Note"));
        S.key(tab, "opacity", 0, 0);
        S.cursor(S.w * 0.78, 122);
        var t = S.move(n, 150, 650);
        t = S.click(t + 50);
        var ws = ["100%", "82%", "56%"];
        [].forEach.call(n.querySelectorAll("b"), function (b, i) {
          S.key(b, "width", 0, "0%").key(b, "width", t + 150 + i * 380, "0%", "linear").key(b, "width", t + 500 + i * 380, ws[i]);
        });
        t += 1300;
        t = S.move({ x: S.w * 0.8, y: 70 }, t + 150, 550);
        t = S.click(t + 60);
        if (k === "on") {
          t += 150;
          S.key(n, "width", t, "124px").key(n, "width", t + 420, "60px");
          S.key(n, "height", t, "78px").key(n, "height", t + 420, "20px");
          [].forEach.call(n.querySelectorAll("b"), function (b) {
            S.key(b, "opacity", t, 1).key(b, "opacity", t + 160, 0);
          });
          S.key(tab, "opacity", t + 260, 0).key(tab, "opacity", t + 450, 1);
        }
      },
    },
    dock: {
      cases: [
        { key: "auto", label: "When needed", caption: "The toolbar shows up only when the page has notes." },
        { key: "mini", label: "Always, small", caption: "A tiny Page Notes icon always waits in the corner." },
        { key: "off", label: "Hidden", caption: "No toolbar — add notes with keyboard shortcuts." },
      ],
      play: function (m, S, k) {
        if (k === "auto") {
          S.cursor(S.w * 0.5, 118);
          var t = S.move(m.ext, 250, 800);
          t = S.click(t + 60);
          S.pop(note(m.page, "", { left: "40%", top: "26px" }), t + 200);
          S.slide(toolbar(m.page).el, t + 600);
        } else if (k === "mini") {
          var tb = toolbar(m.page, true);
          S.slide(tb.el, 250);
          var p = S.pos(tb.el);
          S.ring(p.x, p.y, 900, true);
          S.ring(p.x, p.y, 1500, true);
        } else {
          var keys = h("div", "pv-keys");
          var list = shortcutKeys();
          var ks = list.map(function (x, i) {
            var kc = h("kbd", "", x);
            keys.append(kc);
            if (i < list.length - 1) keys.append(h("span", "", "+"));
            return kc;
          });
          keys.append(h("span", "pv-kl", "New note"));
          m.page.append(keys);
          S.pop(keys, 300);
          ks.forEach(function (kc, i) {
            var s = 900 + i * 90;
            S.key(kc, "transform", s, "translateY(0)").key(kc, "transform", s + 80, "translateY(2px)").key(kc, "transform", 1400, "translateY(2px)").key(kc, "transform", 1500, "translateY(0)");
          });
          S.pop(note(m.page, "", { left: "52%", top: "18px" }), 1600);
        }
      },
    },
    resetPos: {
      cases: [{ key: "reset", label: "Drag & reset", caption: "Drag the toolbar by its logo; Reset position puts it back in the corner." }],
      play: function (m, S) {
        var tb = toolbar(m.page);
        var chip = m.page.appendChild(h("span", "pv-chip", "Reset position"));
        S.key(chip, "opacity", 0, 0);
        S.cursor(S.w * 0.55, 50);
        var t = S.move(tb.mas, 150, 650);
        S.press(t + 60, true);
        var p = S.pos(tb.el);
        var dx = -(p.l - 10);
        t += 200;
        S.key(tb.el, "transform", t, "translateX(0px)", MOVE).key(tb.el, "transform", t + 900, "translateX(" + dx + "px)");
        t = S.move({ x: S.cx + dx, y: S.cy }, t, 900);
        S.press(t + 60, false);
        t += 350;
        S.pop(chip, t);
        t = S.move(chip, t + 250, 650);
        t = S.click(t + 60);
        S.key(tb.el, "transform", t + 100, "translateX(" + dx + "px)", POP).key(tb.el, "transform", t + 650, "translateX(0px)");
        S.ring(p.x, p.y, t + 600, true);
      },
    },
    tips: {
      cases: [
        { key: "on", label: "On", caption: "Small hints appear near the toolbar now and then." },
        { key: "off", label: "Off", caption: "No hints — only the toolbar." },
      ],
      play: function (m, S, k) {
        toolbar(m.page);
        if (k === "on") {
          var tip = h("div", "pv-tip");
          tip.append(h("b", "", "Tip"), document.createTextNode(SHORTCUT ? " Press " + SHORTCUT + " to add a note" : " Use a keyboard shortcut to add a note"));
          m.page.append(tip);
          S.pop(tip, 700, "translateY(6px) scale(.9)");
        } else S.key(m.page, "opacity", 0, 1).key(m.page, "opacity", 1500, 1);
      },
    },
    guide: {
      cases: [
        { key: "on", label: "On", caption: "A guide card opens above the toolbar while you place a note." },
        { key: "off", label: "Off", caption: "Only the ghost note follows your cursor." },
      ],
      play: function (m, S, k) {
        placing(m, S, k === "on" ? "full" : "none");
      },
    },
    guideMode: {
      cases: [
        { key: "full", label: "Full guide", caption: "The full guide card opens while you place a note." },
        { key: "compact", label: "Compact", caption: "Only a small ? shows — click it to open the guide." },
      ],
      play: function (m, S, k) {
        placing(m, S, k);
      },
    },
    undo: {
      cases: [
        { key: "on", label: "On", caption: "A toast lets you bring a deleted note back." },
        { key: "off", label: "Off", caption: "The note is deleted right away, without an Undo toast." },
      ],
      play: function (m, S, k) {
        var n = note(m.page, "p", { left: "20%", top: "58px", zIndex: "3" });
        var trash = h("div", "pv-trash");
        trash.append(icon("M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9"), h("span", "", "Drop to delete"));
        m.page.append(trash);
        S.key(trash, "opacity", 0, 0);
        S.cursor(S.w * 0.62, 118);
        var t = S.move(n, 150, 650);
        S.press(t + 50, true);
        t += 150;
        S.key(trash, "opacity", t, 0).key(trash, "opacity", t + 200, 1);
        var a = S.pos(n);
        var b = S.pos(trash);
        S.key(n, "transform", t, "translate(0px,0px) scale(1)", MOVE).key(n, "transform", t + 850, "translate(" + (b.x - a.x) + "px," + (b.y - a.y + 18) + "px) scale(.55)");
        t = S.move({ x: b.x, y: b.y + 18 }, t, 850);
        S.press(t + 40, false);
        S.key(n, "transform", t + 60, "translate(" + (b.x - a.x) + "px," + (b.y - a.y + 18) + "px) scale(.55)").key(n, "transform", t + 320, "translate(" + (b.x - a.x) + "px," + (b.y - a.y) + "px) scale(.1)");
        S.key(n, "opacity", t + 60, 1).key(n, "opacity", t + 320, 0);
        S.key(trash, "opacity", t + 450, 1).key(trash, "opacity", t + 700, 0);
        S.move({ x: S.w * 0.75, y: 70 }, t + 400, 600);
        if (k === "on") {
          var toast = h("div", "pv-toast");
          toast.append(h("span", "", "Note deleted"), h("b", "", "Undo"));
          m.page.append(toast);
          S.slide(toast, t + 600);
        }
      },
    },
    snapshots: {
      cases: [
        { key: "on", label: "On", caption: "A small screenshot is saved with each note, so the list is easy to scan." },
        { key: "off", label: "Off", caption: "Notes are listed as text only." },
      ],
      play: function (m, S, k) {
        note(m.page, "", { left: "14%", top: "40px" });
        var card = h("div", "pv-card");
        var body = h("div", "pv-cb");
        body.append(h("small", "", "Notes list"), h("b"), h("b"), h("b"));
        var t = 500;
        if (k === "on") {
          var flash = m.win.appendChild(h("i", "pv-flash"));
          S.key(flash, "opacity", 0, 0).key(flash, "opacity", 450, 0).key(flash, "opacity", 520, 0.9, "ease-out").key(flash, "opacity", 900, 0);
          var snap = badge(m.page, "Snapshot saved", { bottom: "10px" }, CAMERA);
          S.pop(snap, 560);
          S.fade(snap, 1500);
          var th = h("div", "pv-thumb");
          th.append(h("i"), h("i"), h("i", "n"));
          card.append(th);
          t = 1150;
          S.pop(th, t + 350);
        }
        card.append(body);
        m.page.append(card);
        S.pop(card, t, "translateX(24px)");
      },
    },
    dev: {
      mock: { lines: false },
      cases: [
        { key: "on", label: "On", caption: "Notes stick to page elements — kept apart from your normal notes." },
        { key: "off", label: "Off", caption: "Normal notes, no element outlines." },
      ],
      play: function (m, S, k) {
        var b1 = at(h("div", "pv-block"), { left: "16px", top: "34px", width: "40%", height: "62px" });
        var b2 = at(h("div", "pv-block"), { left: "calc(40% + 28px)", top: "34px", width: "24%", height: "62px" });
        m.page.append(b1, b2);
        S.cursor(S.w * 0.8, 120);
        var t = S.move({ x: S.pos(b1).x + 20, y: S.pos(b1).y + 6 }, 150, 750);
        if (k === "on") {
          var o = at(h("div", "pv-outline"), { left: "13px", top: "31px", width: "calc(40% + 6px)", height: "68px" });
          o.append(h("span", "pv-tag", "div.card"));
          m.page.append(o);
          S.key(o, "opacity", 0, 0).key(o, "opacity", t - 150, 0).key(o, "opacity", t, 1);
        }
        t = S.click(t + 400);
        if (k === "on") {
          S.pop(note(m.page, "b", { left: "calc(40% - 50px)", top: "10px" }), t + 150);
          S.pop(badge(m.page, "Inspect notes are separate", { bottom: "10px" }), t + 700);
        } else {
          // drop the note at the cursor, kept fully inside the window
          S.pop(note(m.win, "", { left: S.cx + 6 + "px", top: Math.min(S.cy + 6, S.wr.height - 66) + "px" }), t + 150);
        }
      },
    },
  };

  // ---------- panels ----------
  var entries = {};
  var openId = null;

  /** Build the Preview button + panel for one setting. */
  function setup(id) {
    var cfg = P[id];
    var group = root.querySelector('.opts[data-key="' + id + '"]');
    var control = group ? null : document.getElementById(id);
    if (!group && !control) return;
    var row = group ? group.previousElementSibling : control.closest(".row");
    var after = group || row;
    var e = { id: id, cfg: cfg, group: group, control: control, row: row };

    var btn = h("button", "pv-btn");
    btn.type = "button";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "pv-" + id);
    btn.append(icon("M4.5 2.8v10.4L13 8z"), h("span", "pv-btip", "Preview what this does"));
    btn.setAttribute("aria-label", "Preview what this does");
    // rows are <label>s: point them at their own control, or the label would "click" this button (first labelable child)
    if (row.tagName === "LABEL" && control && control.id && !row.htmlFor) row.htmlFor = control.id;
    if (control) row.insertBefore(btn, control);
    else row.append(btn);
    btn.addEventListener("click", function (ev) {
      ev.preventDefault(); // inside a <label>: don't flip the switch
      if (openId === id) close(id, true);
      else open(id);
    });

    var panel = h("div", "pv-panel");
    panel.id = "pv-" + id;
    panel.setAttribute("role", "region");
    panel.hidden = true;
    var inner = h("div", "pv-in");
    var head = h("div", "pv-head");
    var seg = h("div", "pv-seg");
    seg.setAttribute("role", "radiogroup");
    seg.setAttribute("aria-label", "Compare");
    var rp = h("button", "pv-rp");
    rp.type = "button";
    rp.append(icon("M13 3.5v3.2H9.8M13 6.7A5.5 5.5 0 1 0 13.4 10"), h("span", "", "Replay"));
    rp.onclick = function () {
      play(e);
    };
    head.append(h("span", "pv-t", "Preview"), seg, h("span", "pv-sp"), rp);
    var stage = h("div", "pv-stage");
    var cap = h("p", "pv-cap");
    cap.setAttribute("aria-live", "polite");
    inner.append(head, stage, cap);
    panel.append(inner);
    after.parentNode.insertBefore(panel, after.nextSibling);

    if (cfg.cases.length < 2) seg.hidden = true;
    cfg.cases.forEach(function (c) {
      var b = h("button", "", c.label);
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("data-k", c.key);
      b.onclick = function () {
        e.sel = c.key;
        play(e);
      };
      seg.append(b);
    });
    seg.addEventListener("keydown", function (ev) {
      var d = ev.key === "ArrowRight" || ev.key === "ArrowDown" ? 1 : ev.key === "ArrowLeft" || ev.key === "ArrowUp" ? -1 : 0;
      if (!d) return;
      ev.preventDefault();
      var keys = cfg.cases.map(function (c) {
        return c.key;
      });
      if (getComputedStyle(seg).direction === "rtl" && (ev.key === "ArrowRight" || ev.key === "ArrowLeft")) d = -d;
      e.sel = keys[(keys.indexOf(e.sel) + d + keys.length) % keys.length];
      play(e);
      seg.querySelector('[data-k="' + e.sel + '"]').focus();
    });

    Object.assign(e, { btn: btn, panel: panel, seg: seg, stage: stage, cap: cap });
    entries[id] = e;

    // follow the real setting while the panel is open
    if (group) new MutationObserver(function () { sync(e); }).observe(group, { attributes: true, subtree: true, attributeFilter: ["aria-pressed"] });
    else if (id === "resetPos") control.addEventListener("click", function () { if (openId === id) play(e); });
    else control.addEventListener("change", function () { sync(e); });
  }
  /** Current real value of a setting, as a case key. */
  function current(e) {
    if (e.group) {
      var b = e.group.querySelector(".opt[aria-pressed=true]");
      return b ? b.getAttribute("data-val") : e.cfg.cases[0].key;
    }
    if (e.id === "resetPos") return "reset";
    return e.control.checked ? "on" : "off";
  }
  /** When the real setting changes, switch the open panel to it and replay. */
  function sync(e) {
    var v = current(e);
    if (v === e.cur) return;
    e.cur = v;
    if (openId === e.id) {
      e.sel = v;
      play(e);
    }
  }
  /** Rebuild the stage for the selected case and play it. */
  function play(e) {
    var c = e.cfg.cases.filter(function (x) { return x.key === e.sel; })[0] || e.cfg.cases[0];
    e.sel = c.key;
    [].forEach.call(e.seg.children, function (b) {
      var k = b.getAttribute("data-k");
      b.setAttribute("aria-checked", String(k === e.sel));
      b.tabIndex = k === e.sel ? 0 : -1;
      b.classList.toggle("cur", k === e.cur && e.cfg.cases.length > 1);
      b.title = k === e.cur ? "Your current setting" : "";
      // option names follow the page language when available
      var opt = e.group && e.group.querySelector('.opt[data-val="' + k + '"] b');
      if (opt && opt.textContent.trim()) b.textContent = opt.textContent.trim();
    });
    var m = mock(e.stage, e.cfg.mock);
    var S = new Scene(m.win);
    e.cfg.play(m, S, e.sel);
    S.commit(!!(reduce && reduce.matches));
    e.cap.textContent = c.caption;
  }
  /** Open one panel (closing any other). */
  function open(id) {
    if (openId) close(openId, false);
    var e = entries[id];
    openId = id;
    var title = e.row.querySelector(".txt b");
    e.panel.setAttribute("aria-label", "Preview: " + (title ? title.textContent : id));
    e.btn.setAttribute("aria-expanded", "true");
    if (e.anim) e.anim.cancel();
    e.panel.hidden = false;
    e.cur = current(e);
    e.sel = e.cur;
    play(e);
    if (!(reduce && reduce.matches)) e.anim = e.panel.animate([{ height: "0px", opacity: 0 }, { height: e.panel.scrollHeight + "px", opacity: 1 }], { duration: 260, easing: EASE });
  }
  /**
   * Close a panel.
   * @param {string} id - setting id
   * @param {boolean} focus - move focus back to its Preview button
   */
  function close(id, focus) {
    var e = entries[id];
    if (openId === id) openId = null;
    e.btn.setAttribute("aria-expanded", "false");
    if (focus) e.btn.focus();
    if (e.anim) e.anim.cancel();
    var done = function () {
      e.panel.hidden = true;
      e.stage.textContent = "";
    };
    if (reduce && reduce.matches) return done();
    e.anim = e.panel.animate([{ height: e.panel.offsetHeight + "px", opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 200, easing: EASE, fill: "forwards" });
    e.anim.onfinish = function () {
      done();
      e.anim.cancel();
      e.anim = null;
    };
  }

  Object.keys(P).forEach(setup);
  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Escape" || !openId || document.body.getAttribute("data-view") !== "settings") return;
    if (document.querySelector(".sheet.on")) return; // dialogs close first (notes.js)
    close(openId, true);
  });
})();
