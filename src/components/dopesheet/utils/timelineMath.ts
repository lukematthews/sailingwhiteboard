import { clamp } from "../../../lib/math";
import { snapTime } from "../../../lib/time";
import type { Step } from "../../../types";

export function sortSteps(list: Step[]) {
  return list.slice().sort((a, b) => a.tMs - b.tMs);
}

export function frameStepMs(fps: number) {
  return Math.max(1, Math.round(1000 / fps));
}

export function snapClamp(t: number, durationMs: number, fps: number) {
  return snapTime(clamp(t, 0, durationMs), fps);
}

export function mostMovedHandleIndex(prevFull: number[], nextFull: number[]) {
  let bestI = 0;
  let bestD = -1;
  const n = Math.max(prevFull.length, nextFull.length);

  for (let i = 0; i < n; i++) {
    const d = Math.abs((nextFull[i] ?? 0) - (prevFull[i] ?? 0));
    if (d > bestD) {
      bestD = d;
      bestI = i;
    }
  }
  return bestI;
}