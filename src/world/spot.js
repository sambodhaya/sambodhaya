// Pages opened from inside the 3D temple carry ?from=3d, so the site can offer the way back here;
// the spot (position, facing and view) is kept for this browser tab only, and restored on return.
// Leaving the temple and the "no 3D" map are deliberate exits, so they don't carry it.
// (Only the storage and the address here: world.js takes the spot from, and puts it back on, the player and camera.)
export const to2d = (hash) => `index.html?from=3d#${hash}`;
export const SPOT_KEY = "sambodhaya-3d-spot";
// spot: { x, z, yaw, camYaw, camPitch, camDist }; it is kept with the time
export function saveSpotData(spot) {
  try { sessionStorage.setItem(SPOT_KEY, JSON.stringify({ ...spot, t: Date.now() })); } catch (e) {}
}
// this page's address with ?return=1: the temple opens again where the child was (after a lost picture, or a change
// of quality)
export function returnURL(href) { const u = new URL(href); u.searchParams.set("return", "1"); return u.toString(); }
// the kept spot when this visit comes back to the temple (?return=1, or the browser's back and forward) and the spot
// is less than 6 hours old; else null. ?return=1 is taken out of the address either way.
export function takeSpot() {
  const nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
  const returning = /[?&]return=1\b/.test(location.search) || (nav && nav.type === "back_forward");
  if (!returning) return null;
  let spot = null; try { spot = JSON.parse(sessionStorage.getItem(SPOT_KEY) || "null"); } catch (e) {}
  if (/[?&]return=1\b/.test(location.search)) { try { history.replaceState(null, "", location.pathname + location.search.replace(/[?&]return=1\b/, "").replace(/^&/, "?")); } catch (e) {} }
  if (!spot || Date.now() - spot.t > 6 * 3600 * 1000) return null;
  return spot;
}
