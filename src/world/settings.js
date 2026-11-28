// Settings shared with the 2D site (localStorage, under sambodhaya-*), and the visitor's language.
// `settings` is one object, changed in place by world.js; read/write keep any other value on this device.

export const read = (k, d) => { try { const v = localStorage.getItem("sambodhaya-" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
export const write = (k, v) => { try { localStorage.setItem("sambodhaya-" + k, JSON.stringify(v)); return true; } catch (e) { return false; } };
export const settings = { lang: "th", calmMotion: false, mute: false, guide: true, ...read("settings", {}) };
// the device asking for less motion turns calm motion on, unless the visitor has chosen for themselves (🍃 in the menu)
if (read("settings", {}).calmMotion === undefined && matchMedia("(prefers-reduced-motion: reduce)").matches) settings.calmMotion = true;
// world.html?lang=en (or ?lang=th) chooses the language, and keeps it (the 2D pages read the same setting)
{ const q = (location.search.match(/[?&]lang=(th|en)\b/) || [])[1]; if (q) { settings.lang = q; write("settings", { ...read("settings", {}), lang: q }); } }
export const L = settings.lang === "en" ? "en" : "th";
export const tx = (th, en) => (L === "en" ? en : th);
export const txo = (o) => tx(o.th, o.en); // a {th, en} text in the visitor's language
