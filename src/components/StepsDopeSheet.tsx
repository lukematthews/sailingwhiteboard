// src/components/StepsDopeSheet.tsx
import React, { useMemo, useRef, useState } from "react";
import { Slider } from "antd";
import { clamp } from "../lib/math";
import { snapTime, formatTime } from "../lib/time";
import type { Boat, Step, StepsByBoatId } from "../types";
import { upsertStep } from "../animation/steps";

type Props = {
  boats: Boat[];
  stepsByBoatId: StepsByBoatId;
  setStepsByBoatId: React.Dispatch<React.SetStateAction<StepsByBoatId>>;

  displayedBoats: Boat[];

  timeMs: number;
  durationMs: number;
  fps: number;

  selectedBoatId: string | null;
  setSelectedBoatId: (id: string | null) => void;

  setTimeMs: (t: number) => void;
  setIsPlaying: (p: boolean) => void;
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
}: Props) {
  const [ripple, setRipple] = useState(true);

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

  const addStepAtPlayhead = (boatId: string) => {
    const pose = displayedById.get(boatId);
    if (!pose) return;

    const t = snapClamp(timeMs, durationMs, fps);

    setStepsByBoatId((prev) =>
      upsertStep(prev, boatId, t, { x: pose.x, y: pose.y, headingMode: "auto" }),
    );

    setSelectedBoatId(boatId);
    setIsPlaying(false);
    setTimeMs(t);
  };

  const deleteStepById = (boatId: string, stepId: string) => {
    setStepsByBoatId((prev) => {
      const list = prev[boatId] || [];
      return { ...prev, [boatId]: list.filter((s) => s.id !== stepId) };
    });

    setSelectedStepIdByBoatId((prev) => ({
      ...prev,
      [boatId]: prev[boatId] === stepId ? null : prev[boatId] ?? null,
    }));
  };

  const selectStep = (boatId: string, stepId: string) => {
    setSelectedBoatId(boatId);
    setSelectedStepIdByBoatId((prev) => ({ ...prev, [boatId]: stepId }));

    const lane = sortSteps(stepsByBoatId[boatId] || []);
    const s = lane.find((x) => x.id === stepId);
    if (s) {
      setIsPlaying(false);
      setTimeMs(s.tMs);
    }
  };

  // Apply interior times (NOT including endpoints) to the lane.
  const applyInteriorTimes = (
    boatId: string,
    snappedInteriorSorted: number[],
    movedInteriorIndex: number | null,
    oldInterior: number[],
  ) => {
    setStepsByBoatId((prev) => {
      const lane = sortSteps(prev[boatId] || []);
      if (lane.length === 0) return prev;

      // Pair by ORDER (stable)
      let out = lane.map((s, i) => ({
        ...s,
        tMs: snappedInteriorSorted[i] ?? s.tMs,
      }));

      if (ripple && movedInteriorIndex != null) {
        const oldT = oldInterior[movedInteriorIndex] ?? null;
        const newT = snappedInteriorSorted[movedInteriorIndex] ?? null;

        if (oldT != null && newT != null) {
          const delta = newT - oldT;
          if (delta !== 0) {
            out = out.map((s, i) => {
              // Shift anything that was originally after the pivot old time
              if ((lane[i]?.tMs ?? 0) > oldT) return { ...s, tMs: clamp(s.tMs + delta, 0, durationMs) };
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

      return { ...prev, [boatId]: out };
    });
  };

  // Lane slider values include fixed endpoints: [0, ...interior..., durationMs]
  const updateFromLaneSlider = (boatId: string, newValsAny: number | number[]) => {
    const raw = Array.isArray(newValsAny) ? newValsAny.slice() : [newValsAny];
    if (raw.length < 2) return;

    // Force endpoints even if AntD tries to move them
    raw[0] = 0;
    raw[raw.length - 1] = durationMs;

    // Snap/clamp and sort (defensive)
    const snapped = raw.map((t) => snapClamp(t, durationMs, fps)).slice().sort((a, b) => a - b);
    snapped[0] = 0;
    snapped[snapped.length - 1] = durationMs;

    const snappedInterior = snapped.slice(1, -1);

    // Determine which handle moved most (FULL array includes ends)
    const prevFull = prevLaneValuesRef.current[boatId] || [];
    prevLaneValuesRef.current[boatId] = snapped.slice();

    let bestI = 0;
    let bestD = -1;
    for (let i = 0; i < snapped.length; i++) {
      const d = Math.abs((snapped[i] ?? 0) - (prevFull[i] ?? 0));
      if (d > bestD) {
        bestD = d;
        bestI = i;
      }
    }

    // Ignore attempts to move endpoints (prevents “instant jump” feeling)
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
    applyInteriorTimes(boatId, snappedInterior, movedInteriorIndex, oldInterior);
  };

  const scrubTo = (t: number) => {
    setIsPlaying(false);
    setTimeMs(clamp(t, 0, durationMs));
  };

  return (
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      {/* top bar */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-slate-700">Steps Timeline</div>

        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input type="checkbox" checked={ripple} onChange={(e) => setRipple(e.target.checked)} />
          Ripple timing
        </label>
      </div>

      <div className="rounded-lg bg-white ring-1 ring-slate-200">
        <div className="grid grid-cols-[140px_minmax(0,1fr)_88px] items-start">
          {/* Scrubber row */}
          <div className="col-span-3 border-b border-slate-200">
            <div className="grid grid-cols-[140px_minmax(0,1fr)_88px] items-start">
              <div className="px-2 py-3 text-xs text-slate-600">{formatTime(timeMs)}</div>
              <div className="px-2 py-3 min-w-0">
                <Slider
                  className="w-full"
                  style={{ width: "100%", maxWidth: "none" }}
                  min={0}
                  max={Math.max(1, durationMs)}
                  step={scrubberStep}
                  value={Math.round(timeMs)}
                  onChange={(v) => scrubTo(Number(v))}
                  tooltip={{ formatter: (v) => (typeof v === "number" ? formatTime(v) : "") }}
                />
              </div>
              <div className="px-2 py-3 text-right text-xs text-slate-600">
                {formatTime(durationMs)}
              </div>
            </div>
          </div>

          {/* Boat lanes */}
          {boats.map((boat) => {
            const laneSteps = sortSteps(stepsByBoatId[boat.id] || []);
            const isBoatSelected = selectedBoatId === boat.id;
            const selectedStepId = selectedStepIdByBoatId[boat.id] ?? null;

            const interiorValues = laneSteps.map((s) => s.tMs);
            const sliderValues = [0, ...interiorValues, durationMs];

            return (
              <div key={boat.id} className="col-span-3 border-b border-slate-200 last:border-b-0">
                <div className="grid grid-cols-[140px_minmax(0,1fr)_88px] items-start">
                  {/* left */}
                  <div className="px-2 py-3">
                    <button
                      className={`rounded-lg px-2 py-1 text-xs ring-1 ${
                        isBoatSelected
                          ? "bg-slate-900 text-white ring-slate-900"
                          : "bg-slate-50 text-slate-800 ring-slate-200 hover:bg-slate-100"
                      }`}
                      onClick={() => setSelectedBoatId(boat.id)}
                    >
                      {boat.label}
                    </button>
                  </div>

                  {/* middle */}
                  <div className="px-2 py-3 min-w-0">
                    <div className="grid grid-rows-[32px_36px] gap-1 min-w-0">
                      <div className="min-w-0 flex items-center gap-1 overflow-x-auto whitespace-nowrap">
                        {laneSteps.length === 0 ? (
                          <div className="text-[11px] text-slate-500">No steps yet</div>
                        ) : (
                          laneSteps.map((s, i) => {
                            const isSelected = s.id === selectedStepId;
                            const isAtPlayhead = Math.abs(s.tMs - snapTime(timeMs, fps)) < 1;

                            return (
                              <button
                                key={s.id}
                                onClick={() => selectStep(boat.id, s.id)}
                                className={`group relative shrink-0 rounded-md px-2 py-1 text-[11px] ring-1 ${
                                  isSelected
                                    ? "bg-slate-900 text-white ring-slate-900"
                                    : isAtPlayhead
                                      ? "bg-emerald-50 text-emerald-900 ring-emerald-200 hover:bg-emerald-100"
                                      : "bg-slate-50 text-slate-800 ring-slate-200 hover:bg-slate-100"
                                }`}
                                title={`Step ${i + 1} @ ${formatTime(s.tMs)}`}
                              >
                                {i + 1}
                                <span className="ml-1 text-[10px] opacity-60">
                                  {formatTime(s.tMs)}
                                </span>

                                <button
                                  className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded bg-white text-[10px] text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 group-hover:flex"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    deleteStepById(boat.id, s.id);
                                  }}
                                  title="Delete step"
                                >
                                  ×
                                </button>
                              </button>
                            );
                          })
                        )}
                      </div>

                      {/* Lane slider with FIXED endpoints */}
                      <div className="min-w-0">
                        <Slider
                          className="steps-lane-slider w-full"
                          style={{ width: "100%", maxWidth: "none" }}
                          range
                          min={0}
                          max={Math.max(1, durationMs)}
                          step={scrubberStep}
                          value={sliderValues}
                          onChange={(v) => updateFromLaneSlider(boat.id, v as any)}
                          onChangeComplete={(v) => updateFromLaneSlider(boat.id, v as any)}
                          tooltip={{ formatter: (v) => (typeof v === "number" ? formatTime(v) : "") }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* right */}
                  <div className="px-2 py-3">
                    <div className="flex justify-end">
                      <button
                        className="h-8 rounded-lg bg-slate-50 px-2 text-xs ring-1 ring-slate-200 hover:bg-slate-100"
                        onClick={() => addStepAtPlayhead(boat.id)}
                      >
                        + Step
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* IMPORTANT: keep lane sliders “handle-only” with CSS (AntD 6.x has no clickable=)
          Put in your global CSS:

          .steps-lane-slider { pointer-events: none; }
          .steps-lane-slider .ant-slider-handle { pointer-events: auto; }

          Optional: hide fixed endpoint handles (first/last) if desired:
          .steps-lane-slider .ant-slider-handle:first-of-type,
          .steps-lane-slider .ant-slider-handle:last-of-type { opacity: 0; pointer-events: none; }
      */}
    </div>
  );
}