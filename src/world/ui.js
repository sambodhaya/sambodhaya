// The temple's HTML on top of the 3D view: the dialog (one at a time, everything behind it out of reach while it is
// open) and the small notes near the top of the screen (toasts). The elements are world.html's #dlg, #dlg-title,
// #dlg-body and #toast; world.js hands the dialog what it needs once, with initDialog.

export const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ---------------- the dialog ---------------- */
// canvas: focused when the dialog closes and nothing had focus before; keys: the held keys, let go when it opens;
// getKid: which child is acting now (two players; it may throw before the two-player code has loaded)
let deps = null;
export function initDialog({ canvas, keys, getKid }) { deps = { canvas, keys, getKid }; }
export const dialogOpen = () => !$("dlg").hidden;
let lastFocus = null;
let opener = null; // which child opened the dialog (two players)
export const dialogKid = () => opener;
export function openDialog(title, html) {
  lastFocus = document.activeElement; try { opener = deps.getKid(); } catch (e) {} // (a choice made in it is that child's; before the two-player code has loaded, nobody's)
  $("dlg-title").textContent = title; $("dlg-body").innerHTML = html; $("dlg").hidden = false;
  // everything behind it is out of reach while it is open (Tab stays in the dialog, screen readers stay in it)
  for (const el of document.body.children) if (el !== $("dlg") && !el.contains($("dlg")) && !el.inert) { el.inert = true; el.dataset.dlgInert = "1"; }
  for (const k in deps.keys) deps.keys[k] = false;
  const f = $("dlg").querySelector("button, a, input"); if (f) f.focus();
}
export function closeDialog() {
  $("dlg").hidden = true;
  for (const el of document.querySelectorAll("[data-dlg-inert]")) { el.inert = false; delete el.dataset.dlgInert; }
  if (lastFocus && lastFocus.focus) lastFocus.focus(); else deps.canvas.focus();
}

/* ---------------- toasts ---------------- */
// small notes near the top of the screen, one after another
const toasts = []; let toastBusy = false;
export function toast(html, secs = 7) { toasts.push([html, secs]); if (!toastBusy) nextToast(); }
function nextToast() {
  const el = $("toast"), n = toasts.shift(); if (!el) return;
  if (!n) { el.hidden = true; toastBusy = false; return; }
  toastBusy = true; el.innerHTML = n[0]; el.hidden = false; setTimeout(nextToast, n[1] * 1000);
}
