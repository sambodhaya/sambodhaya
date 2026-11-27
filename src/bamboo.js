// Clumping bamboo built in code (from the author's own jungle game "Stripped: 21 Days", src/world/flora.js):
// 20-38 culms per clump, leaning out and arching under leafy tops, with young pale culms, dull old ones, the odd
// dead one and fresh shoots. Leaves are cut-out sprays drawn on a canvas at load time, so nothing is downloaded.
// bambooClump() returns { parts: [{ geo, mat }], height, radius }; world.js instances it like a model.
import * as THREE from "three";

const TAU = Math.PI * 2, UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pick = (r, a, b) => a + r() * (b - a);
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- canvas textures ----------
function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; }
function texOf(c, wrap = false) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const hsl = (h, s, l, a = 1) => `hsla(${h.toFixed(0)},${s.toFixed(0)}%,${l.toFixed(0)}%,${a})`;
function leafPath(g, L, W) {
  g.beginPath(); g.moveTo(0, 0);
  g.bezierCurveTo(L * 0.12, -W * 0.6, L * 0.45, -W * 0.54, L, 0);
  g.bezierCurveTo(L * 0.45, W * 0.54, L * 0.12, W * 0.6, 0, 0);
}
function drawLeaf(g, x, y, ang, L, W, col, curl) {
  g.save(); g.translate(x, y); g.rotate(ang); g.transform(1, curl, 0, 1, 0, 0);
  const gr = g.createLinearGradient(0, 0, L, 0);
  gr.addColorStop(0, col[0]); gr.addColorStop(0.55, col[1]); gr.addColorStop(1, col[0]);
  leafPath(g, L, W); g.fillStyle = gr; g.fill();
  g.strokeStyle = "rgba(225,235,170,0.45)"; g.lineWidth = Math.max(0.8, W * 0.07); g.beginPath(); g.moveTo(0, 0); g.lineTo(L * 0.92, 0); g.stroke();
  g.restore();
}
// a twig with leaves hanging off it; the twig starts at (8, 36)
function drawSpray() {
  const w = 512, h = 256, [c, g] = canvas(w, h), r = makeRng(4);
  const x0 = 8, y0 = 36, x1 = w - 30, y1 = h * 0.22, cx = w * 0.5, cy = 20;
  const at = (t) => [(1 - t) ** 2 * x0 + 2 * t * (1 - t) * cx + t * t * x1, (1 - t) ** 2 * y0 + 2 * t * (1 - t) * cy + t * t * y1];
  g.strokeStyle = "#56602c"; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.stroke();
  const n = 15;
  for (let i = 0; i < n; i++) {
    const t = 0.12 + (i / (n - 1)) * 0.88, [x, y] = at(t), last = i === n - 1;
    const ang = last ? 0.25 : pick(r, 0.7, 1.35) * (i % 2 ? 1 : 0.8);
    const L = pick(r, 110, 150) * (last ? 1.05 : 1), W = pick(r, 17, 24);
    const hu = pick(r, 80, 100), sa = pick(r, 42, 60), li = pick(r, 28, 42);
    drawLeaf(g, x, y, ang, L, W, [hsl(hu, sa, li - 6), hsl(hu - 4, sa + 4, li + 6)], (r() - 0.5) * 0.25);
  }
  return texOf(c);
}
// a culm: pale with faint streaks, a powdery band and the ridge at the node
function drawCulm() {
  const [c, g] = canvas(64, 256), r = makeRng(9);
  g.fillStyle = "#e4e8d8"; g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "70,90,40" : "255,255,240"},${0.04 + r() * 0.08})`; g.fillRect(r() * 64, 0, 1 + r() * 2, 256); }
  const gr = g.createLinearGradient(0, 196, 0, 256); gr.addColorStop(0, "rgba(255,255,250,0)"); gr.addColorStop(0.7, "rgba(250,250,240,0.55)"); gr.addColorStop(1, "rgba(250,250,240,0.2)");
  g.fillStyle = gr; g.fillRect(0, 196, 64, 60);
  g.fillStyle = "rgba(70,70,40,0.75)"; g.fillRect(0, 246, 64, 4);
  g.fillStyle = "rgba(255,255,230,0.6)"; g.fillRect(0, 242, 64, 2);
  g.fillStyle = "rgba(60,60,30,0.35)"; g.fillRect(0, 250, 64, 6);
  return texOf(c, true);
}

// ---------- geometry ----------
class Mesher {
  constructor() { this.p = []; this.uv = []; this.c = []; this.i = []; }
  get n() { return this.p.length / 3; }
  vert(p, u, v, col) { this.p.push(p.x, p.y, p.z); this.uv.push(u, v); this.c.push(col.r, col.g, col.b); return this.n - 1; }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i); g.computeVertexNormals(); g.computeBoundingSphere();
    return g;
  }
}
function tube(m, pts, radii, sides, vPerM, col, u0 = 0) {
  let v = 0, prev = null;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], T = (i < pts.length - 1 ? pts[i + 1].clone().sub(p) : p.clone().sub(pts[i - 1])).normalize();
    const N = Math.abs(T.x) < 0.9 ? V().crossVectors(T, V(1, 0, 0)).normalize() : V().crossVectors(T, V(0, 0, 1)).normalize();
    const B = V().crossVectors(T, N);
    if (i) v += p.distanceTo(pts[i - 1]) * vPerM;
    const ring = [];
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * TAU, d = N.clone().multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
      ring.push(m.vert(p.clone().addScaledVector(d, radii[i]), u0 + j / sides, v, col));
    }
    if (prev) for (let j = 0; j < sides; j++) m.quad(prev[j], prev[j + 1], ring[j + 1], ring[j]);
    prev = ring;
  }
}
// a cut-out card: origin O, along A (width w), down D (height h); the twig's start in the canvas lands on O
function card(m, O, A, D, w, h, col, ou = 0.016, ov = 0.14) {
  const tl = O.clone().addScaledVector(A, -ou * w).addScaledVector(D, -ov * h);
  const tr = tl.clone().addScaledVector(A, w), bl = tl.clone().addScaledVector(D, h), br = tr.clone().addScaledVector(D, h);
  const a = m.vert(tl, 0, 1, col), b = m.vert(tr, 1, 1, col), c = m.vert(br, 1, 0, col), d = m.vert(bl, 0, 0, col);
  m.quad(a, d, c, b);
}
// soft foliage normals ("away from the middle, and up"), so the leafy mass shades as one and never goes black from behind
function softNormals(geo, c) {
  const P = geo.attributes.position, N = geo.attributes.normal, n = V(), o = V();
  for (let i = 0; i < P.count; i++) {
    n.fromBufferAttribute(N, i); if (n.y < 0) n.negate();
    o.fromBufferAttribute(P, i).sub(c); if (o.lengthSq() > 1e-6) o.normalize();
    n.multiplyScalar(0.35).addScaledVector(o, 0.65).addScaledVector(UP, 0.35).normalize();
    N.setXYZ(i, n.x, n.y, n.z);
  }
}

// ---------- materials: wind sway from the water clock; leaves keep one normal on both faces ----------
let T = null;
const mats = {};
function swayMat(key, mat, time, amount, leaf) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWaterTime = time;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float uWaterTime;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        { vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
          float k = pow(max(position.y, 0.0) / 11.0, 2.0) * ${amount.toFixed(3)} * 11.0, ph = ip.x * 0.11 + ip.y * 0.07;
          float gust = 0.6 + 0.4 * sin(uWaterTime * 0.35 + ip.x * 0.05 + ip.y * 0.04);
          transformed.x += k * gust * (sin(uWaterTime * 0.9 + ph) * 0.7 + sin(uWaterTime * 2.3 + ph * 3.0) * 0.2);
          transformed.z += k * gust * cos(uWaterTime * 0.7 + ph) * 0.5; }`);
    if (leaf) {
      sh.fragmentShader = sh.fragmentShader.replace("#include <normal_fragment_begin>", THREE.ShaderChunk.normal_fragment_begin.replace("normal *= faceDirection;", ""))
        // thin leaves on cut-out cards vanish in the smaller mip levels: grow alpha with the mip level
        .replace("#include <alphatest_fragment>", `
          #ifdef USE_MAP
            vec2 mipD = vec2(textureSize(map, 0)); vec2 mdx = dFdx(vMapUv * mipD), mdy = dFdy(vMapUv * mipD);
            diffuseColor.a *= 1.0 + max(0.5 * log2(max(dot(mdx, mdx), dot(mdy, mdy))), 0.0) * 0.3;
          #endif
          #include <alphatest_fragment>`);
    }
  };
  mat.customProgramCacheKey = () => "bamboo-" + key;
  return mat;
}
function materials(time) {
  if (T) return T;
  T = { leaf: drawSpray(), culm: drawCulm() };
  mats.culm = swayMat("culm", new THREE.MeshStandardMaterial({ map: T.culm, vertexColors: true, roughness: 0.5, metalness: 0 }), time, 0.012, false);
  mats.leaf = swayMat("leaf", new THREE.MeshStandardMaterial({ map: T.leaf, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.62, metalness: 0 }), time, 0.012, true);
  return T;
}

// ---------- a clump ----------
// seed picks the clump; lod: the far version (3-sided culms, half the leaf cards, no side branches or shoots).
// time: the { value } uniform that drives the wind.
export function bambooClump(seed, lod, time) {
  materials(time);
  const r = makeRng(seed), cm = new Mesher(), lm = new Mesher();
  const n = 20 + Math.floor(r() * 18), R = 0.4 + r() * 0.45;
  const COL = { green: new THREE.Color(0.22, 0.36, 0.10), yg: new THREE.Color(0.42, 0.45, 0.14), old: new THREE.Color(0.30, 0.31, 0.17), dead: new THREE.Color(0.40, 0.32, 0.2), young: new THREE.Color(0.30, 0.46, 0.16) };
  let top = 0;
  for (let k = 0; k < n; k++) {
    const a = r() * TAU, d = R * Math.sqrt(r()), base = V(Math.cos(a) * d, -0.3, Math.sin(a) * d);
    const out = V(Math.cos(a + (r() - 0.5) * 0.6), 0, Math.sin(a + (r() - 0.5) * 0.6));
    const age = r(), young = age < 0.14, dead = age > 0.94, old = age > 0.72 && !dead;
    const H = young ? pick(r, 4, 7.5) : pick(r, 8, 13) * (1 - 0.18 * d / R), rad = young ? pick(r, 0.03, 0.04) : pick(r, 0.04, 0.055);
    const lean = 0.03 + 0.2 * (d / R) + r() * 0.07, arch = (young ? 0.03 : pick(r, 0.06, 0.12) + 0.1 * d / R) * H;
    const col = dead ? COL.dead : young ? COL.young : old ? COL.old : (r() < 0.4 ? COL.yg : COL.green);
    const len = dead ? H * pick(r, 0.45, 0.75) : H;
    const at = (u) => base.clone().addScaledVector(out, Math.sin(lean) * H * u + arch * u * u * u).add(V(0, H * u * Math.cos(lean) * (1 - 0.05 * u * u), 0));
    const segs = lod ? 4 : Math.max(5, Math.ceil(len / 1.2)), pts = [], radii = [];
    for (let i = 0; i <= segs; i++) { const u = (i / segs) * (len / H); pts.push(at(u)); radii.push(rad * (1 - 0.45 * u)); }
    tube(cm, pts, radii, lod ? 3 : 6, 1 / pick(r, 0.32, 0.42), col, r());
    top = Math.max(top, pts[pts.length - 1].y);
    if (dead) continue;
    // leaf sprays at the nodes of the top part, more and droopier right at the top
    const leafTint = old ? new THREE.Color(1.08, 1.0, 0.7) : young ? new THREE.Color(0.95, 1.06, 0.85) : new THREE.Color(pick(r, 0.85, 1.02), pick(r, 0.95, 1.05), pick(r, 0.75, 0.9));
    const from = young ? 0.3 : pick(r, 0.45, 0.55), stepU = 0.42 / H;
    for (let u = from; u <= 1.0; u += stepU) {
      const P = at(u), many = u > 0.85 ? 4 : 2 + (r() < 0.5 ? 1 : 0);
      for (let s = 0; s < many; s++) {
        if (lod && r() < 0.5) continue;
        const dir = out.clone().applyAxisAngle(UP, (r() - 0.5) * 3.2), e = u > 0.9 ? pick(r, -0.6, 0.1) : pick(r, -0.35, 0.3);
        const A = dir.clone().multiplyScalar(Math.cos(e)).addScaledVector(UP, Math.sin(e)).normalize();
        const D0 = DOWN.clone().addScaledVector(A, -DOWN.dot(A)).normalize();
        const w = pick(r, 0.9, 1.3) * (lod ? 1.4 : 1), roll = (r() - 0.5) * 1.2;
        card(lm, P.clone().addScaledVector(dir, 0.03), A, D0.clone().applyAxisAngle(A, roll), w, w * 0.5, leafTint);
        if (!lod && r() < 0.55) card(lm, P.clone().addScaledVector(dir, 0.03), A, D0.clone().applyAxisAngle(A, roll + 1.4), w * 0.9, w * 0.45, leafTint);
      }
    }
    // thin side branches lower down, each with a spray at its end
    if (!lod && !young) for (let u = pick(r, 0.28, 0.36); u < from; u += 1.1 / H) {
      if (r() < 0.35) continue;
      const P = at(u), dir = out.clone().applyAxisAngle(UP, (r() - 0.5) * 2.4), bl = pick(r, 0.5, 1.1);
      const tip = P.clone().addScaledVector(dir, bl * 0.85).addScaledVector(UP, bl * 0.5);
      tube(cm, [P, P.clone().lerp(tip, 0.5).addScaledVector(UP, 0.05), tip], [0.009, 0.007, 0.004], 3, 2, col);
      const A = dir.clone().multiplyScalar(0.95).addScaledVector(UP, -0.3).normalize(), D0 = DOWN.clone().addScaledVector(A, -DOWN.dot(A)).normalize();
      card(lm, tip, A, D0.applyAxisAngle(A, (r() - 0.5)), pick(r, 0.6, 0.9), 0.38, leafTint);
    }
  }
  // fresh shoots round the edge of the clump
  if (!lod) for (let k = 0; k < 2 + Math.floor(r() * 4); k++) {
    const a = r() * TAU, d = R + pick(r, 0.05, 0.4), b = V(Math.cos(a) * d, -0.1, Math.sin(a) * d), h = pick(r, 0.3, 1.0);
    tube(cm, [b, b.clone().add(V(0, h * 0.5, 0)), b.clone().add(V((r() - 0.5) * 0.06, h, (r() - 0.5) * 0.06))], [0.06, 0.04, 0.003], 6, 3, new THREE.Color(0.42, 0.36, 0.2));
  }
  const cg = cm.geometry(), lg = lm.geometry();
  softNormals(lg, V(0, top * 0.72, 0));
  return { parts: [{ geo: cg, mat: mats.culm }, { geo: lg, mat: mats.leaf }], height: top, radius: R };
}
