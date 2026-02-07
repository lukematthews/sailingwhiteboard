// src/animation/keyframes.ts
import type { BoatState, Keyframe, KeyframesByBoatId } from "../types";

export function sortedInsertKeyframe(
  list: Keyframe[],
  kf: Keyframe,
): Keyframe[] {
  const out = [...list, kf].sort((a, b) => a.tMs - b.tMs);

  // de-dupe exact same time (keep last)
  const dedup: Keyframe[] = [];
  for (const x of out) {
    const last = dedup[dedup.length - 1];
    if (last && last.tMs === x.tMs) dedup[dedup.length - 1] = x;
    else dedup.push(x);
  }
  return dedup;
}

export function upsertKeyframe(
  prev: KeyframesByBoatId,
  boatId: string,
  tMs: number,
  state: BoatState,
): KeyframesByBoatId {
  const next: KeyframesByBoatId = { ...prev };
  const list = next[boatId] ? [...next[boatId]] : [];
  const kf: Keyframe = { tMs: Math.round(tMs), state: { ...state } };
  next[boatId] = sortedInsertKeyframe(list, kf);
  return next;
}

export function deleteKeyframeAt(
  prev: KeyframesByBoatId,
  boatId: string,
  tMs: number,
): KeyframesByBoatId {
  const list = prev[boatId];
  if (!list || list.length === 0) return prev;

  const target = Math.round(tMs);
  const nextList = list.filter((k) => k.tMs !== target);

  // nothing changed
  if (nextList.length === list.length) return prev;

  const next: KeyframesByBoatId = { ...prev };
  if (nextList.length === 0) delete next[boatId];
  else next[boatId] = nextList;

  return next;
}

export function moveKeyframe(
  prev: KeyframesByBoatId,
  boatId: string,
  fromT: number,
  toT: number,
): KeyframesByBoatId {
  const list = prev[boatId];
  if (!list || list.length === 0) return prev;

  const from = Math.round(fromT);
  const to = Math.round(toT);

  if (from === to) return prev;

  const idx = list.findIndex((k) => k.tMs === from);
  if (idx === -1) return prev;

  const moved = { ...list[idx], tMs: to };

  // remove old, then insert new (dedup handles collisions at the same time)
  const without = list.filter((k) => k.tMs !== from);
  const nextList = sortedInsertKeyframe(without, moved);

  const next: KeyframesByBoatId = { ...prev };
  next[boatId] = nextList;
  return next;
}
