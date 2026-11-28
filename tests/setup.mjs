// Imported first by every test: after this, `await import("../src/world/...")` resolves three.js from vendor/.
// (The modules are imported dynamically, after this has run: static imports are resolved before any code runs.)
import * as module from "node:module";
import { resolve } from "./importmap.mjs";

if (module.registerHooks) module.registerHooks({ resolve }); // (Node 22.15 and later)
else module.register("./importmap.mjs", import.meta.url);
