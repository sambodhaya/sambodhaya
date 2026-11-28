// src/world/assets.js: the model loader's retries, and fitting a model to a height (three.js from vendor/).
import "./setup.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

const THREE = await import("three");
const { loadGlb, fitTo, fitModel } = await import("../src/world/assets.js");

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not ${b}`);
// a loader that fails `fails` times, then gives `value`
const fakeLoader = (fails, value = { scene: "ok" }) => {
  const l = { calls: [] };
  l.load = (url, onLoad, onProgress, onError) => { l.calls.push(url); if (l.calls.length > fails) onLoad(value); else onError(new Error("network")); };
  return l;
};

test("loadGlb: a model that loads at once", async () => {
  const l = fakeLoader(0);
  assert.deepEqual(await loadGlb(l, "a.glb", [0, 0]), { scene: "ok" });
  assert.deepEqual(l.calls, ["a.glb"]);
});

test("loadGlb: a failed request is tried again", async () => {
  const l = fakeLoader(2);
  assert.deepEqual(await loadGlb(l, "b.glb", [0, 0]), { scene: "ok" });
  assert.equal(l.calls.length, 3);
});

test("loadGlb: gives null (and says so once) when it still won't load", async (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const l = fakeLoader(99);
  assert.equal(await loadGlb(l, "c.glb", [0, 0]), null);
  assert.equal(l.calls.length, 3);
  assert.equal(warn.mock.callCount(), 1);
  assert.equal(warn.mock.calls[0].arguments[1], "c.glb");
});

const box = (w, h, d, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d)); m.position.set(x, y, z); return m; };

test("fitTo: scaled to the height, standing on the ground at its centre", () => {
  const model = new THREE.Group(); model.add(box(2, 4, 1, 5, 7, -3)); // (a loaded model: its scene at the origin)
  const holder = fitTo(model, 1);
  const b = new THREE.Box3().setFromObject(holder), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  near(s.y, 1); near(s.x, 0.5); near(b.min.y, 0); near(c.x, 0); near(c.z, 0);
  assert.ok(holder.isGroup);
});

test("fitModel: the avatar's height, on the ground, centred and casting shadows", () => {
  const g = new THREE.Group(), m = box(1, 2, 1, 3, 1, 3); g.add(m);
  fitModel(g);
  const b = new THREE.Box3().setFromObject(g), c = b.getCenter(new THREE.Vector3());
  near(b.getSize(new THREE.Vector3()).y, 2.9); near(b.min.y, 0); near(c.x, 0); near(c.z, 0);
  assert.equal(m.castShadow, true);
  assert.equal(m.frustumCulled, false);
  const g2 = new THREE.Group(); g2.add(box(1, 3, 1)); fitModel(g2, 1.5);
  near(new THREE.Box3().setFromObject(g2).getSize(new THREE.Vector3()).y, 1.5);
});
