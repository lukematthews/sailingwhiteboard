import { lerp, lerpAngle } from "../lib/math";
import type { Boat, KeyframesByBoatId } from "../types";

export function interpolateBoatsAtTime(
  boats: Boat[],
  keyframesByBoatId: KeyframesByBoatId,
  tMs: number,
): Boat[] {
  return boats.map((b) => {
    const kfs = keyframesByBoatId[b.id] || [];
    if (kfs.length === 0) return b;
    if (kfs.length === 1) return { ...b, ...kfs[0].state };

    let i = 0;
    while (i < kfs.length && kfs[i].tMs <= tMs) i++;

    if (i <= 0) return { ...b, ...kfs[0].state };
    if (i >= kfs.length) return { ...b, ...kfs[kfs.length - 1].state };

    const a = kfs[i - 1];
    const c = kfs[i];
    const span = c.tMs - a.tMs;
    const t = span <= 0 ? 0 : (tMs - a.tMs) / span;

    return {
      ...b,
      x: lerp(a.state.x, c.state.x, t),
      y: lerp(a.state.y, c.state.y, t),
      headingDeg: lerpAngle(a.state.headingDeg, c.state.headingDeg, t),
      color: b.color,
      label: b.label,
    };
  });
}
