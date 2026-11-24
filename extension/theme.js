/* Guetix Page Notes — applies the Appearance setting to the extension pages (popup, dashboard, settings).
 *
 * - settings.theme: "system" (default, follows prefers-color-scheme) | "light" | "dark".
 * - Loaded synchronously in <head> so the page never flashes white: the last value is cached in
 *   localStorage and applied at once, then confirmed from chrome.storage.local.
 * - Sets data-theme="dark" on <html> (removed for light); follows storage + system changes live.
 */
(function () {
  var KEY = "gxpn-theme";
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  var pref = "system";
  /** @param {*} v @returns {"system"|"light"|"dark"} */
  function clean(v) {
    return v === "light" || v === "dark" ? v : "system";
  }
  function apply() {
    var dark = pref === "dark" || (pref === "system" && !!mq && mq.matches);
    if (dark) root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
  }
  /** @param {*} v - settings.theme */
  function set(v) {
    pref = clean(v);
    try {
      localStorage.setItem(KEY, pref);
    } catch (e) {}
    apply();
  }
  try {
    pref = clean(localStorage.getItem(KEY));
  } catch (e) {}
  apply();
  if (mq) {
    if (mq.addEventListener) mq.addEventListener("change", apply);
    else if (mq.addListener) mq.addListener(apply);
  }
  try {
    chrome.storage.local.get("settings", function (r) {
      set(r && r.settings && r.settings.theme);
    });
    chrome.storage.onChanged.addListener(function (ch, area) {
      if (area && area !== "local") return;
      if (ch.settings) set(ch.settings.newValue && ch.settings.newValue.theme);
    });
  } catch (e) {}
})();
