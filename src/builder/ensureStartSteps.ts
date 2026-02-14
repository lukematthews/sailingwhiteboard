import type { Boat, Step, StepsByBoatId } from "../types";
import { uid } from "../lib/ids";

export function ensureStartSteps(boats: Boat[], prev: StepsByBoatId): StepsByBoatId {
  let next: StepsByBoatId = prev;
  for (const b of boats) {
    const list = next[b.id] ?? [];
    const hasZero = list.some((s) => s.tMs === 0);
    if (!hasZero) {
      const newStep: Step = {
        id: uid(),
        tMs: 0,
        x: b.x,
        y: b.y,
        headingMode: "auto",
      };
      next = {
        ...next,
        [b.id]: [...list, newStep].sort((a, c) => a.tMs - c.tMs),
      };
    }
  }
  return next;
}