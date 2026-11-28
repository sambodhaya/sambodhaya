// Pure helpers: they hold no state and touch no scene, so the tests (tests/*.test.mjs) can run them in Node.
import * as THREE from "three";

// 0 below a, 1 above b, an S-curve between (smoothstep)
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// where (x, z) lies along a floor (a rotated box {x, z, c, s, hx, hz}): its local z, or null outside it
export const inFloor = (f, x, z) => { const lx = (x - f.x) * f.c - (z - f.z) * f.s, lz = (x - f.x) * f.s + (z - f.z) * f.c; return Math.abs(lx) < f.hx && Math.abs(lz) < f.hz ? lz : null; };
export const paveNoise = (x, z) => { // smooth value noise: slow patches of wear across the ground
  const h = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };
  const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
  return (h(i, j) * (1 - a) + h(i + 1, j) * a) * (1 - b) + (h(i, j + 1) * (1 - a) + h(i + 1, j + 1) * a) * b;
};
export const rockNoise = (() => { // smooth value noise, the same every visit
  const h = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
  const sm = (t) => t * t * (3 - 2 * t);
  const v = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1); return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf; };
  return (x, y) => v(x, y) * 0.55 + v(x * 2.1 + 7, y * 2.1 + 3) * 0.3 + v(x * 4.3 + 1, y * 4.3 + 9) * 0.15;
})();
// the rotation that turns local axes (a1, a2) onto world axes (b1, b2); a1 ⟂ a2 and b1 ⟂ b2
export function basisQuat(a1, a2, b1, b2) {
  const a3 = new THREE.Vector3().crossVectors(a1, a2), b3 = new THREE.Vector3().crossVectors(b1, b2);
  const La = new THREE.Matrix4().makeBasis(a1, a2, a3), Lb = new THREE.Matrix4().makeBasis(b1, b2, b3);
  return new THREE.Quaternion().setFromRotationMatrix(Lb.multiply(La.transpose()));
}
