// src/components/StepsDopeSheet.tsx
import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import { Slider } from "antd";
import { clamp } from "../lib/math";
import { snapTime, formatTime } from "../lib/time";
import type {
  Boat,
  Flag,
  FlagClipsByFlagId,
  FlagCodeClip,
  Step,
  StepsByBoatId,
} from "../types";
import { upsertStep } from "../animation/steps";
import { uid } from "../lib/ids";
import { FocusedBoatLane } from "./dopesheet/FocusedBoatLane";

type Props = {
  boats: Boat[];
  stepsByBoatId: StepsByBoatId;
  setStepsByBoatId: React.Dispatch<React.SetStateAction<StepsByBoatId>>;
  displayedBoats: Boat[];

  flags: Flag[];
  flagClipsByFlagId: FlagClipsByFlagId;
  setFlagClipsByFlagId: React.Dispatch<React.SetStateAction<FlagClipsByFlagId>>;
  selectedFlagId: string | null;
  setSelectedFlagId: (id: string | null) => void;

  timeMs: number;
  durationMs: number;
  fps: number;

  selectedBoatId: string | null;
  setSelectedBoatId: (id: string | null) => void;

  setTimeMs: (t: number) => void;
  setIsPlaying: (p: boolean) => void;

  onPlaybackRateChange?: (rate: number) => void;
  isPlaying?: boolean;
};

function sortSteps(list: Step[]) {
  return list.slice().sort((a, b) => a.tMs - b.tMs);
}
function sortClips(list: FlagCodeClip[]) {
  return list.slice().sort((a, b) => a.startMs - b.startMs);
}
function frameStepMs(fps: number) {
  return Math.max(1, Math.round(1000 / fps));
}
function snapClamp(t: number, durationMs: number, fps: number) {
  return snapTime(clamp(t, 0, durationMs), fps);
}
function snapClampMs(t: number, durationMs: number, fps: number) {
  return snapTime(clamp(t, 0, durationMs), fps);
}

/**
 * Pure helper: apply new interior times to an existing lane.
 * - preserves step order by index
 * - optional ripple after moved index
 * - enforces strictly increasing (>= frame) and clamps to duration bounds
 */
function buildUpdatedLaneTimes(args: {
  lane: Step[]; // sorted
  snappedInteriorByIndex: number[]; // length === lane.length, stable by index
  movedInteriorIndex: number | null;
  rippleEnabled: boolean;
  durationMs: number;
  frame: number;
}): Step[] {
  const {
    lane,
    snappedInteriorByIndex,
    movedInteriorIndex,
    rippleEnabled,
    durationMs,
    frame,
  } = args;

  if (lane.length === 0) return lane;

  const old = lane.map((s) => s.tMs);
  const next = old.slice();

  // Apply the moved handle’s snapped value
  if (movedInteriorIndex != null) {
    next[movedInteriorIndex] =
      snappedInteriorByIndex[movedInteriorIndex] ?? old[movedInteriorIndex];
  }

  // Ripple = shift everything AFTER the moved index by the same delta,
  // based on ORIGINAL times (authoritative).
  if (rippleEnabled && movedInteriorIndex != null) {
    const oldT = old[movedInteriorIndex];
    const newT = next[movedInteriorIndex];
    const delta = newT - oldT;

    if (delta !== 0) {
      for (let i = movedInteriorIndex + 1; i < next.length; i++) {
        next[i] = clamp(old[i] + delta, 0, durationMs);
      }
    }
  }

  // Enforce monotonic increasing by frame (forward pass)
  for (let i = 0; i < next.length; i++) {
    const minT = i === 0 ? 0 : next[i - 1] + frame;
    if (next[i] < minT) next[i] = minT;
  }

  // Enforce that we can still fit before duration (backward pass)
  for (let i = next.length - 1; i >= 0; i--) {
    const maxT = i === next.length - 1 ? durationMs : next[i + 1] - frame;
    if (next[i] > maxT) next[i] = maxT;
  }

  // Clamp again just to be safe
  for (let i = 0; i < next.length; i++) {
    next[i] = clamp(next[i], 0, durationMs);
  }

  return lane.map((s, i) => ({ ...s, tMs: next[i] }));
}

/**
 * Given old slider values and new slider values (including endpoints),
 * determine which handle moved most. Returns index in the FULL array.
 */
function mostMovedHandleIndex(prevFull: number[], nextFull: number[]) {
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

type SelectedKind = "boat" | "flag";

export default function StepsDopeSheet({
  boats,
  stepsByBoatId,
  setStepsByBoatId,
  displayedBoats,
  timeMs,
  durationMs,
  fps,
  selectedBoatId,
  setSelectedBoatId,
  setTimeMs,
  setIsPlaying,
  flags,
  flagClipsByFlagId,
  setFlagClipsByFlagId,
  selectedFlagId,
  setSelectedFlagId,
  isPlaying = false,
}: Props) {
  const frame = frameStepMs(fps);
  const stepMs = frame;

  const [ripple, setRipple] = useState(true);

  // selection: step id per boat, clip id per flag
  const [selectedStepIdByBoatId, setSelectedStepIdByBoatId] = useState<
    Record<string, string | null>
  >({});
  const [selectedClipIdByFlagId, setSelectedClipIdByFlagId] = useState<
    Record<string, string | null>
  >({});

  // track last full slider values (including fixed endpoints) per boat lane
  const prevLaneValuesRef = useRef<Record<string, number[]>>({});

  const displayedById = useMemo(() => {
    const m = new Map<string, Boat>();
    for (const b of displayedBoats) m.set(b.id, b);
    return m;
  }, [displayedBoats]);

  /**
   * ✅ IMPORTANT CHANGE:
   * - viewKind controls the left navigator tab ("Boats"/"Flags")
   * - selection remains in selectedBoatId / selectedFlagId (may be null)
   * - we DO NOT auto-select when switching tabs
   */
  const selectionKind: SelectedKind = selectedFlagId ? "flag" : "boat";
  const [viewKind, setViewKind] = useState<SelectedKind>(selectionKind);

  // Follow explicit selection changes (e.g. clicking a boat, adding first flag)
  useEffect(() => {
    setViewKind(selectionKind);
  }, [selectionKind]);

  // ✅ Allow "no selection". Only enforce mutual exclusivity if both end up set.
  useEffect(() => {
    if (selectedBoatId && selectedFlagId) {
      if (viewKind === "boat") setSelectedFlagId(null);
      else setSelectedBoatId(null);
    }
  }, [
    selectedBoatId,
    selectedFlagId,
    viewKind,
    setSelectedBoatId,
    setSelectedFlagId,
  ]);

  // (Optional) If you decide you want to clear selection when playing:
  // useEffect(() => {
  //   if (isPlaying) {
  //     setSelectedBoatId(null);
  //     setSelectedFlagId(null);
  //   }
  // }, [isPlaying, setSelectedBoatId, setSelectedFlagId]);

  const scrubTo = useCallback(
    (t: number) => {
      setIsPlaying(false);
      setTimeMs(clamp(t, 0, durationMs));
    },
    [durationMs, setIsPlaying, setTimeMs],
  );

  // ----------------------------
  // Boats
  // ----------------------------
  const addStepAtPlayhead = useCallback(
    (boatId: string) => {
      const pose = displayedById.get(boatId);
      if (!pose) return;

      const t = snapClamp(timeMs, durationMs, fps);

      setStepsByBoatId((prev) =>
        upsertStep(prev, boatId, t, {
          x: pose.x,
          y: pose.y,
          headingMode: "auto",
        }),
      );

      setViewKind("boat");
      setSelectedBoatId(boatId);
      setSelectedFlagId(null);

      setIsPlaying(false);
      setTimeMs(t);
    },
    [
      displayedById,
      timeMs,
      durationMs,
      fps,
      setStepsByBoatId,
      setSelectedBoatId,
      setSelectedFlagId,
      setIsPlaying,
      setTimeMs,
    ],
  );

  const deleteStepById = useCallback(
    (boatId: string, stepId: string) => {
      setStepsByBoatId((prev) => {
        const list = prev[boatId] || [];
        return { ...prev, [boatId]: list.filter((s) => s.id !== stepId) };
      });

      setSelectedStepIdByBoatId((prev) => ({
        ...prev,
        [boatId]: prev[boatId] === stepId ? null : (prev[boatId] ?? null),
      }));
    },
    [setStepsByBoatId],
  );

  const selectStep = useCallback(
    (boatId: string, stepId: string) => {
      setViewKind("boat");
      setSelectedBoatId(boatId);
      setSelectedFlagId(null);

      setSelectedStepIdByBoatId((prev) => ({ ...prev, [boatId]: stepId }));

      const lane = sortSteps(stepsByBoatId[boatId] || []);
      const s = lane.find((x) => x.id === stepId);
      if (s) {
        setIsPlaying(false);
        setTimeMs(s.tMs);
      }
    },
    [
      stepsByBoatId,
      setSelectedBoatId,
      setSelectedFlagId,
      setIsPlaying,
      setTimeMs,
    ],
  );

  const updateFromLaneSlider = useCallback(
    (boatId: string, newValsAny: number | number[]) => {
      const raw = Array.isArray(newValsAny) ? newValsAny.slice() : [newValsAny];
      if (raw.length < 2) return;

      raw[0] = 0;
      raw[raw.length - 1] = durationMs;

      const lane = sortSteps(stepsByBoatId[boatId] || []);
      if (lane.length === 0) return;

      const prevFull = prevLaneValuesRef.current[boatId] || [];
      const snappedFull = raw.map((t) => snapClamp(t, durationMs, fps));

      // figure out which handle moved
      const bestI = mostMovedHandleIndex(prevFull, snappedFull);
      prevLaneValuesRef.current[boatId] = snappedFull.slice();

      if (bestI === 0 || bestI === snappedFull.length - 1) return;

      const movedInteriorIndex = bestI - 1;

      // interior by index (stable order)
      const interiorByIndex = snappedFull.slice(1, -1);

      // select the moved step
      const movedStep = lane[movedInteriorIndex];
      if (movedStep) {
        setViewKind("boat");
        setSelectedBoatId(boatId);
        setSelectedFlagId(null);
        setSelectedStepIdByBoatId((p) => ({
          ...p,
          [boatId]: movedStep.id,
        }));
      }

      setIsPlaying(false);

      setStepsByBoatId((prev) => {
        const lanePrev = sortSteps(prev[boatId] || []);
        if (!lanePrev.length) return prev;

        const nextLane = buildUpdatedLaneTimes({
          lane: lanePrev,
          snappedInteriorByIndex: interiorByIndex,
          movedInteriorIndex,
          rippleEnabled: ripple,
          durationMs,
          frame,
        });

        return { ...prev, [boatId]: nextLane };
      });
    },
    [
      durationMs,
      fps,
      stepsByBoatId,
      ripple,
      frame,
      setSelectedBoatId,
      setSelectedFlagId,
      setIsPlaying,
      setStepsByBoatId,
    ],
  );

  const updateStepTime = useCallback(
    (boatId: string, stepId: string, newTimeMs: number) => {
      const t = snapClamp(newTimeMs, durationMs, fps);
      setIsPlaying(false);

      setStepsByBoatId((prev) => {
        const lane = sortSteps(prev[boatId] || []);
        if (!lane.length) return prev;

        const idx = lane.findIndex((s) => s.id === stepId);
        if (idx === -1) return prev;

        const oldT = lane[idx].tMs;
        const delta = t - oldT;

        let next = lane.map((s) => (s.id === stepId ? { ...s, tMs: t } : s));

        // ripple shifts steps after the moved step (by original ordering/time)
        if (ripple && delta !== 0) {
          next = next.map((s) => {
            if (s.id === stepId) return s;
            if (s.tMs > oldT)
              return { ...s, tMs: clamp(s.tMs + delta, 0, durationMs) };
            return s;
          });
        }

        // enforce increasing
        next = sortSteps(next);
        for (let i = 1; i < next.length; i++) {
          if (next[i].tMs <= next[i - 1].tMs)
            next[i].tMs = next[i - 1].tMs + frame;
        }
        next = next.map((s) => ({ ...s, tMs: clamp(s.tMs, 0, durationMs) }));

        return { ...prev, [boatId]: next };
      });
    },
    [durationMs, fps, ripple, frame, setStepsByBoatId, setIsPlaying],
  );

  // ----------------------------
  // Flags
  // ----------------------------
  const addClipAtPlayhead = useCallback(
    (flagId: string) => {
      const t0 = snapClampMs(timeMs, durationMs, fps);
      const t1 = snapClampMs(t0 + 30000, durationMs, fps);

      const flag = flags.find((f) => f.id === flagId);
      if (!flag) return;

      const clip: FlagCodeClip = {
        id: uid(),
        startMs: t0,
        endMs: t1,
        code: flag.code,
      };

      setFlagClipsByFlagId((prev) => {
        const list = sortClips([...(prev[flagId] ?? []), clip]);
        return { ...prev, [flagId]: list };
      });

      setViewKind("flag");
      setSelectedFlagId(flagId);
      setSelectedBoatId(null);
      setSelectedClipIdByFlagId((p) => ({ ...p, [flagId]: clip.id }));

      setIsPlaying(false);
      setTimeMs(t0);
    },
    [
      timeMs,
      durationMs,
      fps,
      flags,
      setFlagClipsByFlagId,
      setSelectedFlagId,
      setSelectedBoatId,
      setIsPlaying,
      setTimeMs,
    ],
  );

  const deleteClipById = useCallback(
    (flagId: string, clipId: string) => {
      setFlagClipsByFlagId((prev) => {
        const list = prev[flagId] ?? [];
        return { ...prev, [flagId]: list.filter((c) => c.id !== clipId) };
      });

      setSelectedClipIdByFlagId((prev) => ({
        ...prev,
        [flagId]: prev[flagId] === clipId ? null : (prev[flagId] ?? null),
      }));
    },
    [setFlagClipsByFlagId],
  );

  const selectClip = useCallback(
    (flagId: string, clipId: string) => {
      setViewKind("flag");
      setSelectedFlagId(flagId);
      setSelectedBoatId(null);
      setSelectedClipIdByFlagId((p) => ({ ...p, [flagId]: clipId }));

      const clips = sortClips(flagClipsByFlagId[flagId] ?? []);
      const c = clips.find((x) => x.id === clipId);
      if (c) {
        setIsPlaying(false);
        setTimeMs(c.startMs);
      }
    },
    [
      flagClipsByFlagId,
      setSelectedFlagId,
      setSelectedBoatId,
      setIsPlaying,
      setTimeMs,
    ],
  );

  const updateClipRange = useCallback(
    (flagId: string, clipId: string, range: [number, number]) => {
      const [a, b] = range;
      const startMs = snapClampMs(Math.min(a, b), durationMs, fps);
      const endMs = snapClampMs(Math.max(a, b), durationMs, fps);

      setIsPlaying(false);

      setFlagClipsByFlagId((prev) => {
        const next = sortClips(
          (prev[flagId] ?? []).map((c) =>
            c.id === clipId ? { ...c, startMs, endMs } : c,
          ),
        );
        return { ...prev, [flagId]: next };
      });

      setViewKind("flag");
      setSelectedFlagId(flagId);
      setSelectedBoatId(null);
      setSelectedClipIdByFlagId((p) => ({ ...p, [flagId]: clipId }));
    },
    [
      durationMs,
      fps,
      setFlagClipsByFlagId,
      setIsPlaying,
      setSelectedFlagId,
      setSelectedBoatId,
    ],
  );

  // ----------------------------
  // Focused targets
  // ----------------------------
  const selectedBoat = useMemo(
    () => boats.find((b) => b.id === selectedBoatId) || null,
    [boats, selectedBoatId],
  );
  const selectedFlag = useMemo(
    () => flags.find((f) => f.id === selectedFlagId) || null,
    [flags, selectedFlagId],
  );

  const focusedBoatLane = useMemo(() => {
    if (!selectedBoatId) return [];
    return sortSteps(stepsByBoatId[selectedBoatId] || []);
  }, [selectedBoatId, stepsByBoatId]);

  const focusedFlagClips = useMemo(() => {
    if (!selectedFlagId) return [];
    return sortClips(flagClipsByFlagId[selectedFlagId] ?? []);
  }, [selectedFlagId, flagClipsByFlagId]);

  const clearSelection = useCallback(() => {
    setSelectedBoatId(null);
    setSelectedFlagId(null);
  }, [setSelectedBoatId, setSelectedFlagId]);

  const isNoneSelected = !selectedBoatId && !selectedFlagId;

  return (
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* LEFT: list */}
        <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
          <div className="flex items-center justify-between px-2 py-1">
            <div className="text-xs font-medium text-slate-700">Timeline</div>

            <div className="flex items-center gap-1 rounded-lg bg-slate-50 p-1 ring-1 ring-slate-200">
              <button
                type="button"
                onClick={() => setViewKind("boat")}
                className={`rounded-md px-2 py-1 text-[11px] ${
                  viewKind === "boat"
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                Boats
              </button>
              <button
                type="button"
                onClick={() => setViewKind("flag")}
                className={`rounded-md px-2 py-1 text-[11px] ${
                  viewKind === "flag"
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                Flags
              </button>
            </div>
          </div>

          {viewKind === "boat" ? (
            <div className="mt-2 space-y-1 px-1">
              {/* ✅ None / Clear selection */}
              <button
                type="button"
                onClick={clearSelection}
                className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm ring-1 ${
                  isNoneSelected
                    ? "bg-slate-900 text-white ring-slate-900"
                    : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50"
                }`}
                title="Clear selection"
              >
                <span className="truncate italic opacity-80">None</span>
                <span
                  className={`ml-2 shrink-0 rounded-md px-2 py-0.5 text-[11px] tabular-nums ${
                    isNoneSelected
                      ? "bg-white/15 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  ␀
                </span>
              </button>

              {boats.length === 0 ? (
                <div className="px-2 py-2 text-xs text-slate-500">
                  No boats yet.
                </div>
              ) : (
                boats.map((b) => {
                  const isSel = b.id === selectedBoatId;
                  const count = (stepsByBoatId[b.id] || []).length;

                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setViewKind("boat");
                        setSelectedBoatId(b.id);
                        setSelectedFlagId(null);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm ring-1 ${
                        isSel
                          ? "bg-slate-900 text-white ring-slate-900"
                          : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="truncate">{b.label}</span>
                      <span
                        className={`ml-2 shrink-0 rounded-md px-2 py-0.5 text-[11px] tabular-nums ${
                          isSel
                            ? "bg-white/15 text-white"
                            : "bg-slate-100 text-slate-700"
                        }`}
                        title="Steps"
                      >
                        {count}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <div className="mt-2 space-y-1 px-1">
              {/* ✅ None / Clear selection */}
              <button
                type="button"
                onClick={clearSelection}
                className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm ring-1 ${
                  isNoneSelected
                    ? "bg-slate-900 text-white ring-slate-900"
                    : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50"
                }`}
                title="Clear selection"
              >
                <span className="truncate italic opacity-80">None</span>
                <span
                  className={`ml-2 shrink-0 rounded-md px-2 py-0.5 text-[11px] tabular-nums ${
                    isNoneSelected
                      ? "bg-white/15 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  ␀
                </span>
              </button>

              {flags.length === 0 ? (
                <div className="px-2 py-2 text-xs text-slate-500">
                  No flags.
                </div>
              ) : (
                flags.map((f) => {
                  const isSel = f.id === selectedFlagId;
                  const count = (flagClipsByFlagId[f.id] || []).length;

                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setViewKind("flag");
                        setSelectedFlagId(f.id);
                        setSelectedBoatId(null);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm ring-1 ${
                        isSel
                          ? "bg-slate-900 text-white ring-slate-900"
                          : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <span className="truncate">
                        Flag <span className="font-semibold">{f.code}</span>
                      </span>
                      <span
                        className={`ml-2 shrink-0 rounded-md px-2 py-0.5 text-[11px] tabular-nums ${
                          isSel
                            ? "bg-white/15 text-white"
                            : "bg-slate-100 text-slate-700"
                        }`}
                        title="Clips"
                      >
                        {count}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}

          <div className="mt-3 border-t border-slate-200 px-2 pt-2">
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={ripple}
                onChange={(e) => setRipple(e.target.checked)}
              />
              Ripple steps
            </label>
          </div>
        </div>

        {/* RIGHT: focused editor */}
        <div className="rounded-lg bg-white ring-1 ring-slate-200">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-700">
                {viewKind === "boat" ? "Boat timeline" : "Flag timeline"}
              </div>
              <div className="truncate text-[11px] text-slate-500">
                {viewKind === "boat"
                  ? (selectedBoat?.label ?? "—")
                  : selectedFlag
                    ? `Flag ${selectedFlag.code}`
                    : "—"}
              </div>
            </div>

            {viewKind === "boat" ? (
              <button
                type="button"
                className="h-8 rounded-lg bg-slate-50 px-3 text-xs ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50"
                onClick={() =>
                  selectedBoatId && addStepAtPlayhead(selectedBoatId)
                }
                disabled={!selectedBoatId}
              >
                + Step
              </button>
            ) : (
              <button
                type="button"
                className="h-8 rounded-lg bg-slate-50 px-3 text-xs ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50"
                onClick={() =>
                  selectedFlagId && addClipAtPlayhead(selectedFlagId)
                }
                disabled={!selectedFlagId}
              >
                + Clip
              </button>
            )}
          </div>

          <div className="p-3">
            {viewKind === "boat" ? (
              !selectedBoatId ? (
                <div className="text-sm text-slate-500">
                  No boat selected. Choose one from the list (or keep “None”).
                </div>
              ) : (
                <FocusedBoatLane
                  laneSteps={focusedBoatLane}
                  selectedStepId={
                    selectedStepIdByBoatId[selectedBoatId] ?? null
                  }
                  timeMs={timeMs}
                  fps={fps}
                  durationMs={durationMs}
                  stepMs={stepMs}
                  ripple={ripple}
                  onSelectStep={(stepId) => selectStep(selectedBoatId, stepId)}
                  onDeleteStep={(stepId) =>
                    deleteStepById(selectedBoatId, stepId)
                  }
                  onMoveStep={(stepId, newTimeMs) => {
                    updateStepTime(selectedBoatId, stepId, newTimeMs);
                  }}
                />
              )
            ) : !selectedFlagId ? (
              <div className="text-sm text-slate-500">
                No flag selected. Choose one from the list (or keep “None”).
              </div>
            ) : (
              <FocusedFlagLane
                clips={focusedFlagClips}
                selectedClipId={selectedClipIdByFlagId[selectedFlagId] ?? null}
                timeMs={timeMs}
                fps={fps}
                durationMs={durationMs}
                stepMs={stepMs}
                onSelectClip={(clipId) => selectClip(selectedFlagId, clipId)}
                onDeleteClip={(clipId) =>
                  deleteClipById(selectedFlagId, clipId)
                }
                onClipRangeChange={(clipId, range) =>
                  updateClipRange(selectedFlagId, clipId, range)
                }
                onScrubTo={scrubTo}
              />
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-[11px] text-slate-500">
            <span className="tabular-nums">{formatTime(timeMs)}</span>
            <span className="tabular-nums">{formatTime(durationMs)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FocusedFlagLane(props: {
  clips: FlagCodeClip[];
  selectedClipId: string | null;

  timeMs: number;
  fps: number;
  durationMs: number;
  stepMs: number;

  onSelectClip: (clipId: string) => void;
  onDeleteClip: (clipId: string) => void;
  onClipRangeChange: (clipId: string, range: [number, number]) => void;

  onScrubTo: (t: number) => void;
}) {
  const {
    clips,
    selectedClipId,
    timeMs,
    fps,
    durationMs,
    stepMs,
    onSelectClip,
    onDeleteClip,
    onClipRangeChange,
    onScrubTo,
  } = props;

  return (
    <div className="min-w-0">
      <div className="min-w-0 overflow-x-auto whitespace-nowrap pb-2">
        <div className="inline-flex items-center gap-1">
          {clips.length === 0 ? (
            <div className="text-[11px] text-slate-500">No clips</div>
          ) : (
            clips.map((c, i) => {
              const isSelected = c.id === selectedClipId;
              const isActiveNow = timeMs >= c.startMs && timeMs <= c.endMs;
              const atPlayhead =
                Math.abs(snapTime(timeMs, fps) - c.startMs) < 1;

              return (
                <button
                  key={c.id}
                  onClick={() => onSelectClip(c.id)}
                  className={`group relative shrink-0 rounded-md px-2 py-1 text-[11px] ring-1 ${
                    isSelected
                      ? "bg-slate-900 text-white ring-slate-900"
                      : isActiveNow
                        ? "bg-blue-50 text-blue-900 ring-blue-200 hover:bg-blue-100"
                        : atPlayhead
                          ? "bg-emerald-50 text-emerald-900 ring-emerald-200 hover:bg-emerald-100"
                          : "bg-slate-50 text-slate-800 ring-slate-200 hover:bg-slate-100"
                  }`}
                  title={`Clip ${i + 1}: ${c.code} (${formatTime(
                    c.startMs,
                  )} → ${formatTime(c.endMs)})`}
                  type="button"
                >
                  {c.code}
                  <span className="ml-1 text-[10px] opacity-60">
                    {formatTime(c.startMs)}–{formatTime(c.endMs)}
                  </span>

                  <button
                    className={`absolute -right-1 -top-1 h-4 w-4 items-center justify-center rounded bg-white text-[10px] text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 ${
                      isSelected ? "flex" : "hidden"
                    } group-hover:flex`}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onDeleteClip(c.id);
                    }}
                    title="Delete clip"
                    type="button"
                  >
                    ×
                  </button>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="space-y-2">
        {clips.length === 0 ? (
          <div className="h-[22px] rounded-md bg-slate-50 ring-1 ring-slate-200" />
        ) : (
          clips.map((clip) => {
            const isSelected = clip.id === selectedClipId;

            return (
              <div
                key={clip.id}
                className={`rounded-md px-2 py-1 ring-1 ${
                  isSelected
                    ? "bg-white ring-slate-400"
                    : "bg-slate-50 ring-slate-200"
                }`}
              >
                <Slider
                  className="flag-range-slider w-full"
                  style={{ width: "100%", maxWidth: "none" }}
                  range
                  min={0}
                  max={Math.max(1, durationMs)}
                  step={stepMs}
                  value={[clip.startMs, clip.endMs]}
                  onChange={(v) => {
                    const arr = v as number[];
                    onClipRangeChange(clip.id, [
                      Number(arr[0]),
                      Number(arr[1]),
                    ]);
                    onSelectClip(clip.id);
                  }}
                  onAfterChange={(v) => {
                    const arr = v as number[];
                    onClipRangeChange(clip.id, [
                      Number(arr[0]),
                      Number(arr[1]),
                    ]);
                    onSelectClip(clip.id);
                    // Optional: scrub to start for feedback
                    onScrubTo(Number(arr[0]));
                  }}
                  tooltip={{
                    formatter: (v) =>
                      typeof v === "number" ? formatTime(v) : "",
                  }}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
