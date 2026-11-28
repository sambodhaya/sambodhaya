// Module hooks for the tests: Node resolves "three", "three/addons/..." and "@pixiv/three-vrm" through world.html's
// own import map (to vendor/), as the browser does, and loads the repo's .js files as ES modules (the repo has no
// package.json). Registered by tests/setup.mjs.
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const html = readFileSync(new URL("world.html", root), "utf8");
const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;

// (works both as a synchronous hook, module.registerHooks, and as an asynchronous one, module.register)
export function resolve(spec, context, next) {
  let target = spec;
  if (Object.hasOwn(map, spec)) target = new URL(map[spec], root).href;
  else for (const [k, v] of Object.entries(map)) if (k.endsWith("/") && spec.startsWith(k)) { target = new URL(v + spec.slice(k.length), root).href; break; }
  const esm = (r) => (r.url.startsWith(root.href) && /\.js(\?|$)/.test(r.url) ? { ...r, format: "module" } : r);
  const r = next(target, context);
  return typeof r.then === "function" ? r.then(esm) : esm(r);
}
