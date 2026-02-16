// src/components/StepsDopeSheet.tsx
import React, { useCallback, useMemo, useRef, useState } from "react";
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
import BoatLaneRow from "./dopesheet/BoatLaneRow";
import FlagLaneRow from "./dopesheet/FlagLaneRow";

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

function frameStepMs(fps: number) {
  return Math.max(1, Math.round(1000 / fps));
}

function snapClamp(t: number, durationMs: number, fps: number) {
  return snapTime(clamp(t, 0, durationMs), fps);
}

/**
 * Pure helper: apply new interior times to an existing lane.
 * - preserves step order by index
 * - optional ripple after moved index
 * - enforces strictly increasing (>= frame) and clamps to duration bounds
 */
function buildUpdatedLaneTimes(args: {
  lane: Step[];
  snappedInteriorSorted: number[];
  movedInteriorIndex: number | null;
  oldInterior: number[];
  rippleEnabled: boolean;
  durationMs: number;
  frame: number;
}): Step[] {
  const {
    lane,
    snappedInteriorSorted,
    movedInteriorIndex,
    oldInterior,
    rippleEnabled,
    durationMs,
    frame,
  } = args;
  if (lane.length === 0) return lane;

  // Pair by ORDER (stable)
  let out = lane.map((s, i) => ({
    ...s,
    tMs: snappedInteriorSorted[i] ?? s.tMs,
  }));

  if (rippleEnabled && movedInteriorIndex != null) {
    const oldT = oldInterior[movedInteriorIndex] ?? null;
    const newT = snappedInteriorSorted[movedInteriorIndex] ?? null;

    if (oldT != null && newT != null) {
      const delta = newT - oldT;
      if (delta !== 0) {
        out = out.map((s, i) => {
          // shift anything that was originally after the pivot old time
          if ((lane[i]?.tMs ?? 0) > oldT)
            return { ...s, tMs: clamp(s.tMs + delta, 0, durationMs) };
          return s;
        });
      }
    }
  }

  // Enforce strictly increasing by at least 1 frame
  out = sortSteps(out);
  for (let i = 1; i < out.length; i++) {
    if (out[i].tMs <= out[i - 1].tMs) out[i].tMs = out[i - 1].tMs + frame;
  }

  // Cap after enforcing
  out = out.map((s) => ({ ...s, tMs: clamp(s.tMs, 0, durationMs) }));

  return out;
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

function sortClips(list: FlagCodeClip[]) {
  return list.slice().sort((a, b) => a.startMs - b.startMs);
}

function snapClampMs(t: number, durationMs: number, fps: number) {
  return snapTime(clamp(t, 0, durationMs), fps);
}

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
  onPlaybackRateChange,
  isPlaying: isPlayingProp,
  flags,
  flagClipsByFlagId,
  setFlagClipsByFlagId,
  selectedFlagId,
  setSelectedFlagId,
}: Props) {
  const [ripple, setRipple] = useState(true);

  // Speed affects playback only (parent should multiply dt by this).
  const [playbackRate, _setPlaybackRate] = useState<number>(1);

  // If parent doesn’t pass isPlaying, keep a local mirror for UI.
  const [localIsPlaying, setLocalIsPlaying] = useState(false);
  const isPlaying =
    typeof isPlayingProp === "boolean" ? isPlayingProp : localIsPlaying;

  const setPlaybackRate = useCallback(
    (r: number) => {
      _setPlaybackRate(r);
      onPlaybackRateChange?.(r);
    },
    [onPlaybackRateChange],
  );

  // Selection: step id per boat
  const [selectedStepIdByBoatId, setSelectedStepIdByBoatId] = useState<
    Record<string, string | null>
  >({});

  // Track last full slider values (including fixed endpoints) so we can infer which handle moved.
  const prevLaneValuesRef = useRef<Record<string, number[]>>({});

  const displayedById = useMemo(() => {
    const m = new Map<string, Boat>();
    for (const b of displayedBoats) m.set(b.id, b);
    return m;
  }, [displayedBoats]);

  const frame = frameStepMs(fps);
  const scrubberStep = frame;

  const scrubTo = useCallback(
    (t: number) => {
      setIsPlaying(false);
      setLocalIsPlaying(false);
      setTimeMs(clamp(t, 0, durationMs));
    },
    [durationMs, setIsPlaying, setTimeMs],
  );

  const jumpToStart = useCallback(() => {
    setIsPlaying(false);
    setLocalIsPlaying(false);
    setTimeMs(0);
  }, [setIsPlaying, setTimeMs]);

  const jumpToEnd = useCallback(() => {
    setIsPlaying(false);
    setLocalIsPlaying(false);
    setTimeMs(durationMs);
  }, [durationMs, setIsPlaying, setTimeMs]);

  const togglePlay = useCallback(() => {
    const next = !isPlaying;
    setIsPlaying(next);
    setLocalIsPlaying(next);
  }, [isPlaying, setIsPlaying]);

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

      setSelectedBoatId(boatId);
      setIsPlaying(false);
      setLocalIsPlaying(false);
      setTimeMs(t);
    },
    [
      displayedById,
      timeMs,
      durationMs,
      fps,
      setStepsByBoatId,
      setSelectedBoatId,
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
      setSelectedBoatId(boatId);
      setSelectedStepIdByBoatId((prev) => ({ ...prev, [boatId]: stepId }));

      const lane = sortSteps(stepsByBoatId[boatId] || []);
      const s = lane.find((x) => x.id === stepId);
      if (s) {
        setIsPlaying(false);
        setLocalIsPlaying(false);
        setTimeMs(s.tMs);
      }
    },
    [stepsByBoatId, setSelectedBoatId, setIsPlaying, setTimeMs],
  );

  const updateFromLaneSlider = useCallback(
    (boatId: string, newValsAny: number | number[]) => {
      const raw = Array.isArray(newValsAny) ? newValsAny.slice() : [newValsAny];
      if (raw.length < 2) return;

      // Force endpoints even if AntD tries to move them
      raw[0] = 0;
      raw[raw.length - 1] = durationMs;

      // Snap/clamp and sort (defensive)
      const snapped = raw
        .map((t) => snapClamp(t, durationMs, fps))
        .slice()
        .sort((a, b) => a - b);

      snapped[0] = 0;
      snapped[snapped.length - 1] = durationMs;

      const snappedInterior = snapped.slice(1, -1);

      // Determine which handle moved most (FULL array includes ends)
      const prevFull = prevLaneValuesRef.current[boatId] || [];
      prevLaneValuesRef.current[boatId] = snapped.slice();

      const bestI = mostMovedHandleIndex(prevFull, snapped);

      // Ignore attempts to move endpoints
      if (bestI === 0 || bestI === snapped.length - 1) return;

      // Map to interior index
      const movedInteriorIndex = bestI - 1;

      const lane = sortSteps(stepsByBoatId[boatId] || []);
      const oldInterior = lane.map((s) => s.tMs);

      const movedStep = lane[movedInteriorIndex];
      if (movedStep) {
        setSelectedBoatId(boatId);
        setSelectedStepIdByBoatId((p) => ({ ...p, [boatId]: movedStep.id }));
      }

      setIsPlaying(false);
      setLocalIsPlaying(false);

      setStepsByBoatId((prev) => {
        const lanePrev = sortSteps(prev[boatId] || []);
        if (lanePrev.length === 0) return prev;

        const nextLane = buildUpdatedLaneTimes({
          lane: lanePrev,
          snappedInteriorSorted: snappedInterior,
          movedInteriorIndex,
          oldInterior,
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
      setIsPlaying,
      setStepsByBoatId,
    ],
  );

  // --- Flag selection: clip id per flag
  const [selectedClipIdByFlagId, setSelectedClipIdByFlagId] = useState<
    Record<string, string | null>
  >({});

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

      setSelectedFlagId(flagId);
      setSelectedClipIdByFlagId((p) => ({ ...p, [flagId]: clip.id }));

      setIsPlaying(false);
      setLocalIsPlaying(false);
      setTimeMs(t0);
    },
    [
      timeMs,
      durationMs,
      fps,
      flags,
      setFlagClipsByFlagId,
      setSelectedFlagId,
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
      setSelectedFlagId(flagId);
      setSelectedClipIdByFlagId((p) => ({ ...p, [flagId]: clipId }));

      const clips = sortClips(flagClipsByFlagId[flagId] ?? []);
      const c = clips.find((x) => x.id === clipId);
      if (c) {
        setIsPlaying(false);
        setLocalIsPlaying(false);
        setTimeMs(c.startMs);
      }
    },
    [flagClipsByFlagId, setSelectedFlagId, setIsPlaying, setTimeMs],
  );

  const updateClipRange = useCallback(
    (flagId: string, clipId: string, range: [number, number]) => {
      const [a, b] = range;
      const startMs = snapClampMs(Math.min(a, b), durationMs, fps);
      const endMs = snapClampMs(Math.max(a, b), durationMs, fps);

      setIsPlaying(false);
      setLocalIsPlaying(false);

      setFlagClipsByFlagId((prev) => {
        const next = sortClips(
          (prev[flagId] ?? []).map((c) =>
            c.id === clipId ? { ...c, startMs, endMs } : c,
          ),
        );
        return { ...prev, [flagId]: next };
      });

      // Optional but nice: keep selection in sync with the slider you drag
      setSelectedFlagId(flagId);
      setSelectedClipIdByFlagId((p) => ({ ...p, [flagId]: clipId }));
    },
    [durationMs, fps, setFlagClipsByFlagId, setIsPlaying, setSelectedFlagId],
  );

  return (
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="rounded-lg bg-white ring-1 ring-slate-200">
        <div className="grid grid-cols-[140px_minmax(0,1fr)_88px] items-start">
          {/* Boat lanes */}
          {boats.map((boat) => {
            const laneSteps = sortSteps(stepsByBoatId[boat.id] || []);
            const selectedStepId = selectedStepIdByBoatId[boat.id] ?? null;

            const interiorValues = laneSteps.map((s) => s.tMs);
            const sliderValues = [0, ...interiorValues, durationMs];

            return (
              <BoatLaneRow
                key={boat.id}
                boat={boat}
                laneSteps={laneSteps}
                selectedBoatId={selectedBoatId}
                selectedStepId={selectedStepId}
                timeMs={timeMs}
                fps={fps}
                durationMs={durationMs}
                stepMs={scrubberStep}
                onSelectBoat={(id) => setSelectedBoatId(id)}
                onSelectStep={selectStep}
                onDeleteStep={deleteStepById}
                onAddStepAtPlayhead={addStepAtPlayhead}
                sliderValues={sliderValues}
                onLaneSliderChange={updateFromLaneSlider}
              />
            );
          })}

          {/* Flag lanes */}
          {flags.map((flag) => {
            const clips = sortClips(flagClipsByFlagId[flag.id] ?? []);
            const selectedClipId = selectedClipIdByFlagId[flag.id] ?? null;

            // const selectedClip = selectedClipId ? clips.find((c) => c.id === selectedClipId) : null;
            // const selectedClipRange = selectedClip ? ([selectedClip.startMs, selectedClip.endMs] as [number, number]) : null;

            return (
              <FlagLaneRow
                key={flag.id}
                flag={flag}
                clips={clips}
                selectedFlagId={selectedFlagId}
                selectedClipId={selectedClipId}
                timeMs={timeMs}
                fps={fps}
                durationMs={durationMs}
                stepMs={scrubberStep}
                onSelectFlag={(id) => setSelectedFlagId(id)}
                onSelectClip={selectClip}
                onDeleteClip={deleteClipById}
                onAddClipAtPlayhead={addClipAtPlayhead}
                onClipRangeChange={updateClipRange}
              />
            );
          })}
        </div>

        {/* footer time labels (optional; keep if you like the current layout) */}
        <div className="flex items-center justify-between px-3 pb-2 text-[11px] text-slate-500">
          <span className="tabular-nums">{formatTime(timeMs)}</span>
          <span className="tabular-nums">{formatTime(durationMs)}</span>
        </div>
      </div>
    </div>
  );
}
