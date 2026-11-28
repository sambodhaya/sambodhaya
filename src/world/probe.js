import { write, tx } from "./settings.js";
import { toast } from "./ui.js";

// The frame probe: in detailed graphics, with no quality chosen yet, the first ~10 s of frames after the temple opens
// are timed (only while the page is in view); if most are slower than 24 a second, this device opens in light
// graphics next time, and a note says so (✨ in the menu switches now, or back). world.js sets probe.on.
export const probe = { on: false, n: 0, slow: 0 };
export function probeFrame(raw) {
  if (document.hidden || raw > 0.5) return; // (a pause, not a slow frame)
  probe.n++; if (raw > 1 / 24) probe.slow++;
  if (probe.n < 300) return;
  probe.on = false;
  if (probe.slow / probe.n > 0.5) {
    write("world-quality-auto", "light");
    toast(tx("✨ ภาพละเอียดดูจะหนักไปสำหรับเครื่องนี้ ครั้งหน้าวัดจะเปิดแบบภาพเบา (เปลี่ยนได้ที่ ✨ ในเมนู)", "✨ Detailed graphics seem heavy for this device: next time the temple opens in light graphics (✨ in the menu changes it)"), 9);
  }
}
