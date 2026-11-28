import { L } from "./settings.js";

// What the temple says (hall names, signs, boards, info cards, the stories) lives in content/, edited through /admin;
// src/build.py joins it into content/site.json. If it can't be had, world.html's templeFail says the temple couldn't
// open, with a way on (and the error is thrown on: the temple stops there).
export function loadContent() {
  return fetch("content/site.json", { cache: "no-cache" })
    .then((r) => { if (!r.ok) throw new Error(`content/site.json: ${r.status}`); return r.json(); })
    .catch((e) => { if (window.templeFail) window.templeFail(e); throw e; });
}
// the page in the visitor's language: <html lang>, and every element with data-th / data-en texts
export function setPageLanguage() {
  document.documentElement.lang = L;
  document.querySelectorAll("[data-th]").forEach((el) => { el.textContent = el.dataset[L]; });
}
