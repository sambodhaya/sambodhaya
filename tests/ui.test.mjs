// src/world/ui.js: the dialog and the toasts, on a tiny stand-in for world.html's page (no browser needed).
// Each test loads a fresh copy of the module (a different ?n=), so no dialog or toast carries over.
import "./setup.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";

const set = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });

// just enough of the DOM: elements with an id, hidden/inert, dataset, children, contains, focus and querySelector
function el(id, tag = "div", kids = []) {
  const e = { id, tag, hidden: false, inert: false, dataset: {}, children: kids, textContent: "", innerHTML: "", focused: 0 };
  e.contains = (x) => x === e || e.children.some((c) => c.contains(x));
  e.focus = () => { e.focused++; document.activeElement = e; };
  e.querySelector = (sel) => { const tags = sel.split(",").map((s) => s.trim()); const walk = (n) => { for (const c of n.children) { if (tags.includes(c.tag)) return c; const f = walk(c); if (f) return f; } return null; }; return walk(e); };
  return e;
}
function page() {
  const yes = el("yes", "button"), body = el("dlg-body", "div", [yes]);
  const dlg = el("dlg", "div", [el("dlg-title", "h2"), body]); dlg.hidden = true;
  const hud = el("hud", "div", [el("btn-places", "button")]), canvas = el("view", "canvas"), toastEl = el("toast");
  const already = el("already"); already.inert = true; // (made inert by something else: left alone)
  const wrap = el("wrap", "div", [dlg]); // the dialog's own parent stays reachable
  toastEl.hidden = true;
  const all = [hud, canvas, toastEl, already, wrap];
  const byId = {}; const index = (n) => { byId[n.id] = n; n.children.forEach(index); }; all.forEach(index);
  set("document", {
    activeElement: null, body: { children: all },
    getElementById: (id) => byId[id] || null,
    querySelectorAll: (sel) => { assert.equal(sel, "[data-dlg-inert]"); return Object.values(byId).filter((n) => "dlgInert" in n.dataset); },
  });
  return { dlg, body, yes, hud, canvas, toastEl, already, wrap, byId };
}
let n = 0;
const load = () => import(`../src/world/ui.js?n=${++n}`);

test("$ finds by id; esc makes text safe inside HTML", async () => {
  const p = page(), ui = await load();
  assert.equal(ui.$("hud"), p.hud);
  assert.equal(ui.$("nothing"), null);
  assert.equal(ui.esc(`<a href="x">Tom & Jerry</a>`), "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&lt;/a&gt;");
  assert.equal(ui.esc(7), "7");
});

test("a dialog opens: title, body, the first button focused, everything behind it inert, keys let go", async () => {
  const p = page(), ui = await load(), keys = { w: true, shift: true };
  ui.initDialog({ canvas: p.canvas, keys, getKid: () => "P2" });
  p.byId["btn-places"].focus();
  assert.equal(ui.dialogOpen(), false);
  ui.openDialog("🗺️ Places", "<p>somewhere</p>");
  assert.equal(ui.dialogOpen(), true);
  assert.equal(p.byId["dlg-title"].textContent, "🗺️ Places");
  assert.equal(p.body.innerHTML, "<p>somewhere</p>");
  assert.equal(document.activeElement, p.yes);
  assert.deepEqual(keys, { w: false, shift: false });
  assert.equal(p.hud.inert, true); assert.equal(p.canvas.inert, true); assert.equal(p.toastEl.inert, true);
  assert.equal(p.wrap.inert, false); // (holds the dialog)
  assert.equal(p.already.dataset.dlgInert, undefined);
  assert.equal(ui.dialogKid(), "P2");
});

test("closing it gives everything back, and the focus to what had it", async () => {
  const p = page(), ui = await load();
  ui.initDialog({ canvas: p.canvas, keys: {}, getKid: () => null });
  const btn = p.byId["btn-places"]; btn.focus();
  ui.openDialog("t", "");
  ui.closeDialog();
  assert.equal(ui.dialogOpen(), false);
  assert.equal(p.hud.inert, false); assert.equal(p.canvas.inert, false);
  assert.equal(p.hud.dataset.dlgInert, undefined);
  assert.equal(p.already.inert, true); // (it wasn't the dialog's to undo)
  assert.equal(document.activeElement, btn);
});

test("with nothing focused before, the temple's view gets the focus back", async () => {
  const p = page(), ui = await load();
  ui.initDialog({ canvas: p.canvas, keys: {}, getKid: () => null });
  ui.openDialog("t", "");
  ui.closeDialog();
  assert.equal(p.canvas.focused, 1);
});

test("before the two-player code has loaded (kid not there yet), the dialog still opens, and it is nobody's", async () => {
  const p = page(), ui = await load();
  ui.initDialog({ canvas: p.canvas, keys: {}, getKid: () => { throw new ReferenceError("Cannot access 'kid' before initialization"); } });
  ui.openDialog("t", "<p>x</p>");
  assert.equal(ui.dialogOpen(), true);
  assert.equal(ui.dialogKid(), null);
});

test("toasts: one after another, each for its own time, then hidden", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const p = page(), ui = await load();
  ui.toast("one", 2); ui.toast("two"); // (7 s by default)
  assert.equal(p.toastEl.hidden, false); assert.equal(p.toastEl.innerHTML, "one");
  t.mock.timers.tick(1999); assert.equal(p.toastEl.innerHTML, "one");
  t.mock.timers.tick(1); assert.equal(p.toastEl.innerHTML, "two");
  t.mock.timers.tick(6999); assert.equal(p.toastEl.hidden, false);
  t.mock.timers.tick(1); assert.equal(p.toastEl.hidden, true);
  ui.toast("three", 1); // (a new one shows at once when none is showing)
  assert.equal(p.toastEl.hidden, false); assert.equal(p.toastEl.innerHTML, "three");
  t.mock.timers.tick(1000); assert.equal(p.toastEl.hidden, true);
});

test("no toast element on the page: nothing breaks", async () => {
  set("document", { getElementById: () => null });
  const ui = await load();
  assert.doesNotThrow(() => ui.toast("x"));
});
