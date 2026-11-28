import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

// Every file under assets/ is asked for with its fingerprint (assets/x.glb?v=<hash>), from the list src/build.py
// writes into content/site.json (assetVersions): the files can then be cached for a year (netlify.toml), and a changed
// file has a new address, so a visitor never keeps an old copy. A file not in the list (or no list) keeps its plain path.
let VERSIONS = {};
export function setAssetVersions(v) { VERSIONS = v || {}; }
export const assetUrl = (path) => { const h = VERSIONS[path.replace(/^assets\//, "")]; return h ? `${path}?v=${h}` : path; };

// Every model file loads through loadGlb: a failed request is tried again twice (after 1 s and 4 s: on a phone a
// request now and then just fails), and a file that still won't load is named once in the console. A failure is not
// remembered, so the next time the model is wanted it is asked for again.
export function loadGlb(loader, url, tries = [1000, 4000]) {
  return new Promise((res) => loader.load(assetUrl(url), res, undefined, (err) => {
    if (tries.length) setTimeout(() => loadGlb(loader, url, tries.slice(1)).then(res), tries[0]);
    else { console.warn("Sambodhaya: couldn't load", url, err && (err.message || err)); res(null); }
  }));
}
// Each prop loads once and is cloned; if a file can't load, the simple shapes stay instead.
export const propLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
export const propCache = {};
export function loadProp(name) {
  if (!propCache[name]) propCache[name] = loadGlb(propLoader, `assets/models/${name}.glb`).then((g) => { if (!g) delete propCache[name]; return g ? g.scene : null; });
  return propCache[name];
}
// scale a model so its height is h and stand it on the ground at its centre
export function fitTo(obj, h) {
  const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3());
  obj.scale.setScalar(h / (size.y || 1));
  const b2 = new THREE.Box3().setFromObject(obj), c = b2.getCenter(new THREE.Vector3());
  obj.position.set(-c.x, -b2.min.y, -c.z);
  const holder = new THREE.Group(); holder.add(obj); return holder;
}
// scale a model (an avatar) to the given height, stand it on the ground at its centre; it casts shadows
export function fitModel(obj, height = 2.9) {
  const box = new THREE.Box3().setFromObject(obj); const size = box.getSize(new THREE.Vector3());
  const s = height / (size.y || 1); obj.scale.setScalar(s);
  const box2 = new THREE.Box3().setFromObject(obj);
  obj.position.y -= box2.min.y; const c = box2.getCenter(new THREE.Vector3()); obj.position.x -= c.x; obj.position.z -= c.z;
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
}
