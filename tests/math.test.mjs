import "./setup.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

const THREE = await import("three");
const { smooth, inFloor, paveNoise, rockNoise, basisQuat } = await import("../src/world/math.js");

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} is not ${b}`);

test("smooth: 0 below a, 1 above b, an S-curve between", () => {
  assert.equal(smooth(0, 1, -5), 0);
  assert.equal(smooth(0, 1, 0), 0);
  assert.equal(smooth(0, 1, 1), 1);
  assert.equal(smooth(0, 1, 9), 1);
  near(smooth(0, 1, 0.5), 0.5);
  near(smooth(2, 4, 3), 0.5);
  near(smooth(0, 1, 0.25), 0.15625);
  let last = -1;
  for (let x = -0.1; x <= 1.1; x += 0.01) { const y = smooth(0, 1, x); assert.ok(y >= last); last = y; }
});

test("smooth: a reversed range runs the other way", () => {
  assert.equal(smooth(1, 0, 0), 1);
  assert.equal(smooth(1, 0, 1), 0);
});

test("inFloor: an axis-aligned floor", () => {
  const f = { x: 10, z: -4, c: 1, s: 0, hx: 2, hz: 3 };
  assert.equal(inFloor(f, 10, -4), 0);
  near(inFloor(f, 11, -2), 2);
  near(inFloor(f, 9, -6.5), -2.5);
  assert.equal(inFloor(f, 12.5, -4), null);
  assert.equal(inFloor(f, 10, -7.5), null);
  assert.equal(inFloor(f, 12, -4), null); // (the edge is outside)
});

test("inFloor: a floor turned a quarter", () => {
  const a = Math.PI / 2, f = { x: 0, z: 0, c: Math.cos(a), s: Math.sin(a), hx: 1, hz: 5 };
  // turned, its long side lies along x
  assert.ok(inFloor(f, 4, 0) != null);
  assert.equal(inFloor(f, 0, 4), null);
  near(Math.abs(inFloor(f, 4, 0)), 4, 1e-9);
});

test("paveNoise: between 0 and 1, the same every time, smooth across cells", () => {
  for (let i = 0; i < 500; i++) {
    const x = i * 0.37 - 60, z = i * 0.53 - 80, n = paveNoise(x, z);
    assert.ok(n >= 0 && n <= 1, `${n}`);
    assert.equal(paveNoise(x, z), n);
  }
  near(paveNoise(3 - 1e-7, 5.5), paveNoise(3 + 1e-7, 5.5), 1e-5);
  near(paveNoise(-2.5, 7 - 1e-7), paveNoise(-2.5, 7 + 1e-7), 1e-5);
});

test("rockNoise: between 0 and 1, the same every time, smooth", () => {
  for (let i = 0; i < 500; i++) {
    const x = i * 0.29 - 40, y = i * 0.61 - 70, n = rockNoise(x, y);
    assert.ok(n >= 0 && n <= 1, `${n}`);
    assert.equal(rockNoise(x, y), n);
  }
  near(rockNoise(4 - 1e-7, 1.7), rockNoise(4 + 1e-7, 1.7), 1e-5);
});

test("basisQuat: turns the local axes onto the world axes", () => {
  const V = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
  const cases = [
    [V(1, 0, 0), V(0, 1, 0), V(0, 0, 1), V(1, 0, 0)],
    [V(1, 1, 0), V(-1, 1, 0), V(0, 0, -1), V(0, 1, 0)],
    [V(0.3, -0.2, 0.9), new THREE.Vector3(0.3, -0.2, 0.9).normalize().clone().cross(V(0, 1, 0)).normalize(), V(-1, 0, 0), V(0, 0, 1)],
  ];
  for (const [a1, a2, b1, b2] of cases) {
    const q = basisQuat(a1, a2, b1, b2);
    near(q.length(), 1, 1e-9);
    const r1 = a1.clone().applyQuaternion(q), r2 = a2.clone().applyQuaternion(q);
    near(r1.distanceTo(b1), 0, 1e-6);
    near(r2.distanceTo(b2), 0, 1e-6);
  }
});

test("basisQuat: the same axes give no turn", () => {
  const a1 = new THREE.Vector3(0, 0, 1), a2 = new THREE.Vector3(1, 0, 0);
  const q = basisQuat(a1, a2, a1, a2);
  near(Math.abs(q.w), 1, 1e-9);
});
