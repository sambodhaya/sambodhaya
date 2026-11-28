// src/world/analytics.js: the anonymous visit counts. The browser's globals are stood in for, so nothing is sent.
import "./setup.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

const set = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
set("localStorage", { getItem: () => null, setItem() {} });
set("matchMedia", () => ({ matches: false }));
set("location", { search: "", hostname: "localhost" });
const { createTrack } = await import("../src/world/analytics.js");
const { settings } = await import("../src/world/settings.js");

function browser({ hostname = "sambodhaya.netlify.app", search = "", dnt, gpc, visit = null } = {}) {
  const b = { sent: [], timers: [], listeners: {}, session: new Map(visit ? [["sambodhaya-visit", visit]] : []) };
  set("location", { hostname, search });
  set("navigator", { doNotTrack: dnt, globalPrivacyControl: gpc, sendBeacon: (url, blob) => { b.sent.push({ url, blob }); return true; } });
  set("sessionStorage", { getItem: (k) => b.session.get(k) ?? null, setItem: (k, v) => b.session.set(k, v) });
  set("setInterval", (fn, ms) => { b.timers.push({ fn, ms }); return 0; });
  set("addEventListener", (ev, fn) => { b.listeners[ev] = fn; });
  set("document", { hidden: false });
  set("fetch", () => { throw new Error("fetch should not be needed when sendBeacon works"); });
  b.bodies = async () => Promise.all(b.sent.map(async (s) => JSON.parse(await s.blob.text())));
  return b;
}

test("off away from the live site", () => {
  const b = browser({ hostname: "localhost" });
  const track = createTrack({ device: "desktop", quality: "high" });
  track("w_start");
  assert.equal(b.timers.length, 0);
  assert.equal(b.sent.length, 0);
});

test("off with Do Not Track or Global Privacy Control, even on the live site", () => {
  for (const opt of [{ dnt: "1" }, { gpc: true }]) {
    const b = browser(opt);
    createTrack({ device: "phone", quality: "light" })("w_start");
    assert.equal(b.timers.length, 0);
  }
});

test("on the live site: a visit id for this tab, events sent every 15 s", async () => {
  const b = browser();
  settings.lang = "en";
  const track = createTrack({ device: "tablet", quality: "light" });
  assert.deepEqual(b.timers.map((t) => t.ms), [15000]);
  const v = b.session.get("sambodhaya-visit");
  assert.match(v, /^[a-z0-9]{12}$/);
  track("w_start"); track("w_start"); track("tap_walk", false); track("tap_walk", false);
  b.timers[0].fn();
  assert.equal(b.sent[0].url, "/.netlify/functions/track");
  const [body] = await b.bodies();
  assert.equal(body.v, v);
  assert.equal(body.p, "3d");
  assert.equal(body.d, "tablet");
  assert.equal(body.q, "light");
  assert.equal(body.l, "en");
  assert.deepEqual(body.e.map(([e]) => e), ["w_start", "tap_walk", "tap_walk"]); // (once by default)
  assert.ok(body.e.every(([, s]) => Number.isInteger(s)));
  b.timers[0].fn();
  assert.equal(b.sent.length, 1); // (nothing new: nothing sent)
  settings.lang = "th";
});

test("?track counts away from the live site (for testing), and an existing visit id is kept", async () => {
  const b = browser({ hostname: "localhost", search: "?track", visit: "abcdefgh2345" });
  const track = createTrack({ device: "desktop", quality: "high" });
  track("w_loaded");
  b.listeners.visibilitychange();
  assert.equal(b.sent.length, 0); // (still visible)
  document.hidden = true;
  b.listeners.visibilitychange();
  const [body] = await b.bodies();
  assert.equal(body.v, "abcdefgh2345");
  assert.deepEqual(body.e.map(([e]) => e), ["w_loaded", "hide"]);
});

test("a malformed visit id is replaced", () => {
  const b = browser({ visit: "NOT-OK" });
  createTrack({ device: "desktop", quality: "high" });
  assert.match(b.session.get("sambodhaya-visit"), /^[a-z0-9]{12}$/);
});

test("twenty waiting events are sent at once", async () => {
  const b = browser();
  const track = createTrack({ device: "desktop", quality: "high" });
  for (let i = 0; i < 20; i++) track("e" + i);
  assert.equal(b.sent.length, 1);
  assert.equal((await b.bodies())[0].e.length, 20);
});
