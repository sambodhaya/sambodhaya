import { settings } from "./settings.js";

// Anonymous visit counts (netlify/functions/track.mjs): which steps a visit reaches and how long it stays, never who
// the visitor is. A random id for this browser tab only (sessionStorage, shared with the site's pages), no cookies.
// Off with Do Not Track or Global Privacy Control, and off away from the live site unless ?track is in the address.
// device: "phone", "tablet" or "desktop"; quality: the graphics quality this visit opened in.
export function createTrack({ device, quality }) {
  const live = /(^|\.)sambodhaya\.netlify\.app$/.test(location.hostname) || /[?&]track\b/.test(location.search);
  if (!live || navigator.doNotTrack === "1" || navigator.globalPrivacyControl) return () => {};
  let v = null; try { v = sessionStorage.getItem("sambodhaya-visit"); } catch (e) {}
  if (!v || !/^[a-z0-9]{8,24}$/.test(v)) { v = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join(""); try { sessionStorage.setItem("sambodhaya-visit", v); } catch (e) {} }
  const t0 = performance.now(), sent = new Set(), q = [], sec = () => Math.round((performance.now() - t0) / 1000);
  const flush = () => {
    if (!q.length) return;
    const body = JSON.stringify({ v, p: "3d", d: device, q: quality, l: settings.lang === "en" ? "en" : "th", e: q.splice(0, 40) });
    if (!(navigator.sendBeacon && navigator.sendBeacon("/.netlify/functions/track", new Blob([body], { type: "application/json" })))) fetch("/.netlify/functions/track", { method: "POST", body, keepalive: true }).catch(() => {});
  };
  setInterval(flush, 15000);
  addEventListener("visibilitychange", () => { if (document.hidden) { q.push(["hide", sec()]); flush(); } }); // (how long it stayed)
  return (ev, once = true) => { if (once && sent.has(ev)) return; sent.add(ev); q.push([ev, sec()]); if (q.length >= 20) flush(); };
}
