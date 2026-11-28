// src/world/boot.js (the content fetch, the page's language), src/world/spot.js (the spot kept for the way back from
// the site's pages) and src/world/probe.js (the frame probe), with the browser's globals stood in for.
import "./setup.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

const set = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
const ls = new Map();
set("localStorage", { getItem: (k) => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)) });
set("matchMedia", () => ({ matches: false }));
set("location", { search: "?lang=en", hostname: "localhost", pathname: "/world.html" });
const { loadContent, setPageLanguage } = await import("../src/world/boot.js");
const spot = await import("../src/world/spot.js");
const { probe, probeFrame } = await import("../src/world/probe.js");

/* ---------------- boot ---------------- */
test("the content: content/site.json, never from the cache unchecked", async () => {
  const asked = [];
  set("window", {});
  set("fetch", async (url, opt) => { asked.push([url, opt]); return { ok: true, json: async () => ({ places: { yard: 1 } }) }; });
  assert.deepEqual(await loadContent(), { places: { yard: 1 } });
  assert.deepEqual(asked, [["content/site.json", { cache: "no-cache" }]]);
});

test("content that can't be had: world.html's templeFail is told, and the error is thrown on", async () => {
  const told = [];
  set("window", { templeFail: (e) => told.push(e.message) });
  set("fetch", async () => ({ ok: false, status: 404, json: async () => assert.fail("not read") }));
  await assert.rejects(loadContent(), /content\/site\.json: 404/);
  set("fetch", async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(loadContent(), /Failed to fetch/);
  assert.deepEqual(told, ["content/site.json: 404", "Failed to fetch"]);
  set("window", {}); // (no templeFail on the page: still thrown on)
  await assert.rejects(loadContent(), /Failed to fetch/);
});

test("the page in the visitor's language", () => {
  const els = [{ dataset: { th: "วัด", en: "Temple" }, textContent: "" }, { dataset: { th: "ปิด", en: "Close" }, textContent: "ปิด" }];
  set("document", { documentElement: { lang: "th" }, querySelectorAll: (sel) => { assert.equal(sel, "[data-th]"); return els; } });
  setPageLanguage(); // (?lang=en, above)
  assert.equal(document.documentElement.lang, "en");
  assert.deepEqual(els.map((e) => e.textContent), ["Temple", "Close"]);
});

/* ---------------- spot ---------------- */
function tab({ search = "", nav = "navigate", kept, broken = false } = {}) {
  const t = { session: new Map(kept === undefined ? [] : [[spot.SPOT_KEY, typeof kept === "string" ? kept : JSON.stringify(kept)]]), replaced: [] };
  set("location", { search, pathname: "/world.html", hostname: "localhost" });
  set("performance", { getEntriesByType: (k) => (k === "navigation" ? [{ type: nav }] : []) });
  set("sessionStorage", { getItem: (k) => { if (broken) throw new Error("blocked"); return t.session.get(k) ?? null; }, setItem: (k, v) => { if (broken) throw new Error("blocked"); t.session.set(k, v); } });
  set("history", { replaceState: (s, title, url) => t.replaced.push(url) });
  return t;
}
const here = { x: 3, z: 60, yaw: 1.5, camYaw: 0.2, camPitch: 0.32, camDist: 11 };

test("to2d: a page of the site that knows it was opened from the temple", () => {
  assert.equal(spot.to2d("support"), "index.html?from=3d#support");
});

test("returnURL adds ?return=1, keeping the rest of the address", () => {
  assert.equal(spot.returnURL("http://localhost:8799/world.html?debug#x"), "http://localhost:8799/world.html?debug=&return=1#x");
  assert.equal(spot.returnURL("https://sambodhaya.netlify.app/world.html"), "https://sambodhaya.netlify.app/world.html?return=1");
});

test("the spot is kept for this tab, with the time, and given back on return", () => {
  const t = tab();
  spot.saveSpotData(here);
  const kept = JSON.parse(t.session.get(spot.SPOT_KEY));
  assert.deepEqual(Object.keys(kept), ["x", "z", "yaw", "camYaw", "camPitch", "camDist", "t"]);
  assert.ok(Math.abs(kept.t - Date.now()) < 1000);
  assert.equal(spot.takeSpot(), null); // (a fresh visit, not a return: stand at the gate)
  tab({ nav: "back_forward", kept });
  assert.deepEqual(spot.takeSpot(), kept);
});

test("?return=1 brings it back too, and is taken out of the address", () => {
  const kept = { ...here, t: Date.now() };
  let t = tab({ search: "?return=1", kept });
  assert.deepEqual(spot.takeSpot(), kept);
  assert.deepEqual(t.replaced, ["/world.html"]);
  t = tab({ search: "?debug&return=1&lang=en", kept });
  spot.takeSpot();
  assert.deepEqual(t.replaced, ["/world.html?debug&lang=en"]);
  t = tab({ search: "?return=1&debug", kept });
  spot.takeSpot();
  assert.deepEqual(t.replaced, ["/world.html?debug"]);
});

test("no spot, a spot over 6 hours old, a broken one, or storage that refuses: null", () => {
  let t = tab({ search: "?return=1" });
  assert.equal(spot.takeSpot(), null);
  assert.equal(t.replaced.length, 1); // (?return=1 still taken out)
  tab({ nav: "back_forward", kept: { ...here, t: Date.now() - 6 * 3600 * 1000 - 1000 } });
  assert.equal(spot.takeSpot(), null);
  tab({ nav: "back_forward", kept: "{not json" });
  assert.equal(spot.takeSpot(), null);
  tab({ nav: "back_forward", broken: true });
  assert.equal(spot.takeSpot(), null);
  assert.doesNotThrow(() => spot.saveSpotData(here));
});

/* ---------------- probe ---------------- */
const toastEl = { hidden: true, innerHTML: "" };
function screen() {
  ls.clear(); Object.assign(probe, { on: true, n: 0, slow: 0 }); toastEl.hidden = true;
  set("document", { hidden: false, getElementById: (id) => (id === "toast" ? toastEl : null) });
}

test("the frame probe: a fast device is left as it is", () => {
  screen();
  for (let i = 0; i < 299; i++) probeFrame(1 / 60);
  assert.equal(probe.on, true);
  probeFrame(1 / 60);
  assert.equal(probe.on, false);
  assert.equal(probe.n, 300);
  assert.equal(ls.has("sambodhaya-world-quality-auto"), false);
  assert.equal(toastEl.hidden, true);
});

test("pauses and a hidden page don't count; most frames slow: light graphics next time, and a note says so", (t) => {
  screen(); t.mock.timers.enable({ apis: ["setTimeout"] }); // (the toast's own timing is tested in ui.test.mjs)
  probeFrame(0.6); // (a pause)
  document.hidden = true; probeFrame(0.1); document.hidden = false;
  assert.equal(probe.n, 0);
  for (let i = 0; i < 300; i++) probeFrame(i % 3 ? 1 / 20 : 1 / 60); // (two in three slower than 24 a second)
  assert.equal(probe.on, false);
  assert.equal(ls.get("sambodhaya-world-quality-auto"), '"light"');
  assert.equal(toastEl.hidden, false);
  assert.match(toastEl.innerHTML, /Detailed graphics seem heavy/);
});
