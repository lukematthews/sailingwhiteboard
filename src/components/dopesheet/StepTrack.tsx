// src/components/dopesheet/StepTrack.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { clamp } from "../../lib/math";
import { formatTime } from "../../lib/time";
import type { Step } from "../../types";

type DragMode = "none" | "dragging";

function snapToStep(t: number, stepMs: number) {
  if (!stepMs || stepMs <= 1) return t;
  return Math.round(t / stepMs) * stepMs;
}

export default function StepTrack(props: {
  steps: Step[]; // must be sorted by tMs
  durationMs: number;
  timeMs: number; // playhead
  stepMs: number; // snap step, e.g. frameStepMs(fps)
  minGapMs?: number; // enforce increasing steps by at least this gap (defaults to stepMs)

  ripple: boolean;

  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;

  /**
   * Called continuously while dragging.
   * You receive the stepId and its proposed new time (already snapped/clamped).
   */
  onMoveStep: (stepId: string, newTimeMs: number) => void;

  /**
   * Called at end of drag (optional)
   */
  onMoveStepEnd?: (stepId: string, newTimeMs: number) => void;

  /**
   * Optional: delete selected
   */
  onDeleteStep?: (stepId: string) => void;
}) {
  const {
    steps,
    durationMs,
    timeMs,
    stepMs,
    minGapMs = stepMs,
    ripple,
    selectedStepId,
    onSelectStep,
    onMoveStep,
    onMoveStepEnd,
    onDeleteStep,
  } = props;

  const trackRef = useRef<HTMLDivElement | null>(null);

  // drag state
  const dragIdRef = useRef<string | null>(null);
  const dragStartXRef = useRef<number>(0);
  const dragStartTimesRef = useRef<number[]>([]);
  const dragModeRef = useRef<DragMode>("none");

  // tooltip
  const [hover, setHover] = useState<{ id: string; x: number; t: number } | null>(null);

  const idToIndex = useMemo(() => {
    const m = new Map<string, number>();
    steps.forEach((s, i) => m.set(s.id, i));
    return m;
  }, [steps]);

  const timeToX = (t: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const pct = durationMs <= 0 ? 0 : t / durationMs;
    return pct * rect.width;
  };

  const xToTime = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = clamp(clientX - rect.left, 0, rect.width);
    const pct = rect.width <= 0 ? 0 : x / rect.width;
    return pct * durationMs;
  };

  // Enforce ordering constraints:
  // - selected/moved step gets t
  // - if ripple: later steps shift by delta
  // - always enforce monotonic with minGap
  const computeConstrainedTimes = (movedIndex: number, newT: number) => {
    const oldTimes = dragStartTimesRef.current.slice();
    const oldT = oldTimes[movedIndex] ?? 0;

    const snapped = snapToStep(clamp(newT, 0, durationMs), stepMs);
    const delta = snapped - oldT;

    const out = oldTimes.slice();
    out[movedIndex] = snapped;

    if (ripple && delta !== 0) {
      for (let i = movedIndex + 1; i < out.length; i++) {
        out[i] = clamp(out[i] + delta, 0, durationMs);
      }
    }

    // enforce strictly increasing by minGapMs
    for (let i = 1; i < out.length; i++) {
      if (out[i] <= out[i - 1] + (minGapMs - 1)) {
        out[i] = out[i - 1] + minGapMs;
      }
    }

    // cap at duration
    for (let i = 0; i < out.length; i++) {
      out[i] = clamp(out[i], 0, durationMs);
    }

    // if capping caused a violation, walk backwards to re-fit (rare but important)
    for (let i = out.length - 2; i >= 0; i--) {
      if (out[i] >= out[i + 1] - (minGapMs - 1)) {
        out[i] = out[i + 1] - minGapMs;
      }
    }
    for (let i = 0; i < out.length; i++) {
      out[i] = clamp(out[i], 0, durationMs);
    }

    return out;
  };

  const beginDrag = (stepId: string, clientX: number) => {
    const idx = idToIndex.get(stepId);
    if (idx == null) return;

    dragIdRef.current = stepId;
    dragStartXRef.current = clientX;
    dragStartTimesRef.current = steps.map((s) => s.tMs);
    dragModeRef.current = "dragging";
    onSelectStep(stepId);
  };

  const endDrag = (clientX?: number) => {
    if (dragModeRef.current !== "dragging") return;
    const stepId = dragIdRef.current;
    if (!stepId) return;

    const idx = idToIndex.get(stepId);
    if (idx == null) {
      dragIdRef.current = null;
      dragModeRef.current = "none";
      return;
    }

    // compute final time based on last mouse position if provided
    if (typeof clientX === "number") {
      const rawT = xToTime(clientX);
      const times = computeConstrainedTimes(idx, rawT);
      onMoveStepEnd?.(stepId, times[idx]);
    }

    dragIdRef.current = null;
    dragModeRef.current = "none";
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragModeRef.current !== "dragging") return;
      const stepId = dragIdRef.current;
      if (!stepId) return;

      const idx = idToIndex.get(stepId);
      if (idx == null) return;

      const rawT = xToTime(e.clientX);
      const times = computeConstrainedTimes(idx, rawT);

      // push changes outward; parent updates steps state
      onMoveStep(stepId, times[idx]);
    };

    const onUp = (e: MouseEvent) => {
      endDrag(e.clientX);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToIndex, durationMs, stepMs, minGapMs, ripple, onMoveStep, onMoveStepEnd]);

  const playheadX = timeToX(timeMs);

  return (
    <div className="min-w-0">
      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-10 w-full rounded-xl bg-slate-100 ring-1 ring-slate-200"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          // lightweight hover tooltip: nearest thumb within radius
          const el = trackRef.current;
          if (!el) return;

          const rect = el.getBoundingClientRect();
          const x = e.clientX - rect.left;

          let best: { id: string; dx: number; t: number } | null = null;
          for (const s of steps) {
            const sx = (s.tMs / durationMs) * rect.width;
            const dx = Math.abs(sx - x);
            if (best == null || dx < best.dx) best = { id: s.id, dx, t: s.tMs };
          }
          if (!best || best.dx > 18) {
            setHover(null);
            return;
          }
          setHover({ id: best.id, x: x, t: best.t });
        }}
        onClick={(e) => {
          // click track: optionally select nearest step
          const el = trackRef.current;
          if (!el || steps.length === 0) return;
          const rect = el.getBoundingClientRect();
          const x = e.clientX - rect.left;

          let bestId = steps[0].id;
          let bestDx = Infinity;
          for (const s of steps) {
            const sx = (s.tMs / durationMs) * rect.width;
            const dx = Math.abs(sx - x);
            if (dx < bestDx) {
              bestDx = dx;
              bestId = s.id;
            }
          }
          onSelectStep(bestId);
        }}
      >
        {/* playhead */}
        <div
          className="absolute top-1 bottom-1 w-[2px] bg-slate-900/30"
          style={{ left: `${playheadX}px` }}
        />

        {/* thumbs */}
        {steps.map((s, i) => {
          const pct = durationMs <= 0 ? 0 : (s.tMs / durationMs) * 100;
          const isSelected = s.id === selectedStepId;

          return (
            <div
              key={s.id}
              className="absolute top-1/2 -translate-y-1/2"
              style={{ left: `calc(${pct}% - 14px)` }}
            >
              <button
                type="button"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  beginDrag(s.id, e.clientX);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectStep(s.id);
                }}
                className={`group relative flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ring-1 shadow-sm ${
                  isSelected
                    ? "bg-slate-900 text-white ring-slate-900"
                    : "bg-white text-slate-800 ring-slate-200 hover:bg-slate-50"
                }`}
                title={`Step ${i + 1} @ ${formatTime(s.tMs)}`}
              >
                {i + 1}

                {/* tiny delete for selected */}
                {isSelected && onDeleteStep ? (
                  <span
                    className="absolute -top-2 -right-2 hidden h-5 w-5 items-center justify-center rounded-full bg-white text-[12px] text-slate-800 ring-1 ring-slate-200 shadow group-hover:flex"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      // don't start drag
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteStep(s.id);
                    }}
                    title="Delete step"
                  >
                    ×
                  </span>
                ) : null}
              </button>
            </div>
          );
        })}

        {/* hover tooltip */}
        {hover ? (
          <div
            className="pointer-events-none absolute -top-8 rounded-md bg-slate-900 px-2 py-1 text-[11px] text-white shadow"
            style={{ left: clamp(hover.x, 12, (trackRef.current?.getBoundingClientRect().width ?? 0) - 12) }}
          >
            {formatTime(hover.t)}
          </div>
        ) : null}
      </div>

      {/* footer row */}
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span className="tabular-nums">{formatTime(0)}</span>
        <div className="flex items-center gap-3">
          <span className="tabular-nums">{formatTime(timeMs)}</span>
          <span className="text-slate-300">•</span>
          <span className="tabular-nums">{formatTime(durationMs)}</span>
          <span className="text-slate-300">•</span>
          <span className="tabular-nums">{stepMs}ms</span>
          <span className="text-slate-300">•</span>
          <span className="tabular-nums">{ripple ? "Ripple on" : "Ripple off"}</span>
        </div>
        <span className="tabular-nums">{formatTime(durationMs)}</span>
      </div>
    </div>
  );
}