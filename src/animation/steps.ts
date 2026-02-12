// src/animation/steps.ts
import type { Step, StepsByBoatId } from "../types";
import { uid } from "../lib/ids";

export function upsertStep(
  prev: StepsByBoatId,
  boatId: string,
  tMs: number,
  patch: Pick<Step, "x" | "y"> &
    Partial<Pick<Step, "headingMode" | "headingDeg" | "label">>,
): StepsByBoatId {
  const list = (prev[boatId] || []).slice().sort((a, b) => a.tMs - b.tMs);
  const idx = list.findIndex((s) => s.tMs === tMs);

  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch };
  } else {
    const step: Step = {
      id: uid(),
      tMs,
      x: patch.x,
      y: patch.y,
      headingMode: patch.headingMode ?? "auto",
      headingDeg: patch.headingDeg,
      label: patch.label,
    };
    list.push(step);
    list.sort((a, b) => a.tMs - b.tMs);
  }

  return { ...prev, [boatId]: list };
}