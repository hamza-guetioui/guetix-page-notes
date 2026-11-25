// Self-check for PN.normUrl / PN.rekey (page keys). Run: npm test
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const ctx = { URL };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL("../extension/shared.js", import.meta.url), "utf8") + ";this.PN = PN;", ctx);
const PN = ctx.PN;

// YouTube rewrites ?index= / &t= while a playlist plays: the note must stay on the video
const yt = "https://www.youtube.com/watch?v=kMVBDvNBCsY";
assert.equal(PN.normUrl(yt + "&list=RDfVcWESAZKLs&index=4"), yt);
assert.equal(PN.normUrl("https://www.youtube.com/watch?index=5&v=kMVBDvNBCsY&t=30s#x"), yt);
assert.equal(PN.normUrl("https://www.youtube.com/results?search_query=x"), "https://www.youtube.com/results?search_query=x");
// other sites keep their params, minus tracking
assert.equal(PN.normUrl("https://shop.com/list?index=2&utm_source=a"), "https://shop.com/list?index=2");

// old keys move to the normalized one, merged by note id
const store = {
  ["p:" + yt + "&list=L&index=4"]: { url: "", notes: [{ id: "a" }], updatedAt: 1 },
  ["p:" + yt + "&list=L&index=5"]: { url: "", notes: [{ id: "b" }, { id: "a" }], updatedAt: 3 },
  ["p:" + yt]: { url: yt, notes: [{ id: "c" }], updatedAt: 2 },
  "s:a": "img",
};
const r = PN.rekey(store);
assert.equal(r.remove.length, 2);
assert.equal(r.set["p:" + yt].notes.map((n) => n.id).join(), "c,a,b");
assert.equal(r.set["p:" + yt].url, yt);
assert.equal(PN.rekey({ ["p:" + yt]: { url: yt, notes: [] } }).remove.length, 0);
console.log("urls ok");
