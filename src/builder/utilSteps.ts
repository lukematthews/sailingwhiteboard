import type { Step } from "../types";

export function sortSteps(list: Step[]) {
  return list.slice().sort((a, b) => a.tMs - b.tMs);
}

export function frameStepMs(fps: number) {
  return Math.max(1, Math.round(1000 / fps));
}

export function findClosestStepIndex(steps: Step[], tMs: number) {
  if (steps.length === 0) return -1;
  let bestI = 0;
  let bestD = Infinity;
  for (let i = 0; i < steps.length; i++) {
    const d = Math.abs(steps[i].tMs - tMs);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  return bestI;
}