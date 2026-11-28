// src/world/settings.js reads the device's storage, its reduced-motion setting and the address as it loads, so each
// test sets those up and loads a fresh copy of the module (a different ?n= makes Node load it again).
import "./setup.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

const store = (init = {}, broken = false) => {
  const m = new Map(Object.entries(init));
  return {
    m,
    getItem: (k) => { if (broken) throw new Error("blocked"); return m.has(k) ? m.get(k) : null; },
    setItem: (k, v) => { if (broken) throw new Error("blocked"); m.set(k, String(v)); },
  };
};
const set = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
let n = 0;
async function load({ search = "", saved = {}, reduce = false, broken = false } = {}) {
  const ls = store(Object.fromEntries(Object.entries(saved).map(([k, v]) => ["sambodhaya-" + k, JSON.stringify(v)])), broken);
  set("localStorage", ls);
  set("location", { search, hostname: "localhost" });
  set("matchMedia", (q) => ({ matches: reduce && q === "(prefers-reduced-motion: reduce)" }));
  return { ls, mod: await import(`../src/world/settings.js?n=${++n}`) };
}

test("Thai by default", async () => {
  const { mod } = await load();
  assert.equal(mod.L, "th");
  assert.equal(mod.tx("ไทย", "English"), "ไทย");
  assert.equal(mod.txo({ th: "วัด", en: "temple" }), "วัด");
  assert.deepEqual(mod.settings, { lang: "th", calmMotion: false, mute: false, guide: true });
});

test("the saved language and settings are kept", async () => {
  const { mod } = await load({ saved: { settings: { lang: "en", mute: true } } });
  assert.equal(mod.L, "en");
  assert.equal(mod.tx("ไทย", "English"), "English");
  assert.equal(mod.txo({ th: "วัด", en: "temple" }), "temple");
  assert.equal(mod.settings.mute, true);
  assert.equal(mod.settings.guide, true);
});

test("?lang=en chooses English and keeps it for the 2D pages", async () => {
  const { mod, ls } = await load({ search: "?debug&lang=en", saved: { settings: { lang: "th", mute: true } } });
  assert.equal(mod.L, "en");
  assert.equal(mod.settings.lang, "en");
  assert.deepEqual(JSON.parse(ls.m.get("sambodhaya-settings")), { lang: "en", mute: true });
});

test("?lang=th wins over a saved English; an unknown ?lang is ignored", async () => {
  assert.equal((await load({ search: "?lang=th", saved: { settings: { lang: "en" } } })).mod.L, "th");
  const { mod, ls } = await load({ search: "?lang=fr" });
  assert.equal(mod.L, "th");
  assert.equal(ls.m.has("sambodhaya-settings"), false);
});

test("any other language counts as Thai", async () => {
  const { mod } = await load({ saved: { settings: { lang: "de" } } });
  assert.equal(mod.L, "th");
  assert.equal(mod.tx("ไทย", "English"), "ไทย");
});

test("the device's reduced motion turns calm motion on, unless the visitor chose", async () => {
  assert.equal((await load({ reduce: true })).mod.settings.calmMotion, true);
  assert.equal((await load({ reduce: true, saved: { settings: { calmMotion: false } } })).mod.settings.calmMotion, false);
  assert.equal((await load({ reduce: false })).mod.settings.calmMotion, false);
});

test("read and write: JSON under sambodhaya-, a default when missing or broken", async () => {
  const { mod, ls } = await load();
  assert.equal(mod.read("nothing", 7), 7);
  assert.equal(mod.write("avatar", { kind: "girl" }), true);
  assert.equal(ls.m.get("sambodhaya-avatar"), '{"kind":"girl"}');
  assert.deepEqual(mod.read("avatar", {}), { kind: "girl" });
  ls.m.set("sambodhaya-bad", "{not json");
  assert.equal(mod.read("bad", "d"), "d");
});

test("storage that refuses (a private window) never breaks the temple", async () => {
  const { mod } = await load({ broken: true, search: "?lang=en" });
  assert.equal(mod.L, "en");
  assert.equal(mod.read("settings", 1), 1);
  assert.equal(mod.write("settings", {}), false);
});
