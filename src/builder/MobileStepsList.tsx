import React, { useMemo } from "react";
import type { Boat, Step } from "../types";
import { sortSteps } from "./utilSteps";
import { upsertStep } from "../animation/steps";
import { snapTime } from "../lib/time";

function formatMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${m}:${ss}`;
}

export function MobileStepsList(props: {
  boats: Boat[];
  selectedBoatId: string | null;
  setSelectedBoatId: (id: string | null) => void;

  steps: Step[];
  displayedBoat: Boat | null;

  timeMs: number;
  fps: number;
  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;
  setTimeMs: (t: number) => void;

  setStepsByBoatId: React.Dispatch<React.SetStateAction<Record<string, Step[]>>>;
}) {
  const {
    boats,
    selectedBoatId,
    setSelectedBoatId,
    steps,
    displayedBoat,
    timeMs,
    fps,
    setIsPlaying,
    setTimeMs,
    setStepsByBoatId,
  } = props;

  const sorted = useMemo(() => sortSteps(steps), [steps]);
  const currentSnap = useMemo(() => snapTime(timeMs, fps), [timeMs, fps]);

  const onAddStep = () => {
    if (!selectedBoatId || !displayedBoat) return;

    const t = snapTime(timeMs, fps);

    setStepsByBoatId((prev) =>
      upsertStep(prev, selectedBoatId, t, {
        x: displayedBoat.x,
        y: displayedBoat.y,
        headingMode: "manual",
        headingDeg: displayedBoat.headingDeg,
      }),
    );
  };

  if (!selectedBoatId) {
    return (
      <div className="p-3">
        <div className="text-sm font-semibold text-slate-900 mb-2">Steps</div>
        <div className="text-sm text-slate-600 mb-3">Select a boat to edit steps.</div>

        <div className="flex flex-col gap-2">
          {boats.map((b) => (
            <button
              key={b.id}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left active:scale-[0.99]"
              onClick={() => setSelectedBoatId(b.id)}
            >
              <div className="text-sm font-semibold text-slate-900">{b.label}</div>
              <div className="text-xs text-slate-500">Tap to select</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 pb-2 flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">Steps</div>
          <div className="text-xs text-slate-500">
            {boats.find((b) => b.id === selectedBoatId)?.label ?? "Selected boat"}
          </div>
        </div>

        <button
          className="rounded-xl px-3 py-2 text-sm bg-slate-900 text-white active:scale-[0.99] disabled:opacity-50"
          onClick={onAddStep}
          disabled={!displayedBoat}
        >
          + Step
        </button>
      </div>

      <div className="flex-1 overflow-auto px-3 pb-3">
        {sorted.length === 0 ? (
          <div className="text-sm text-slate-600 rounded-2xl border border-slate-200 bg-white p-3">
            No steps yet. Tap <span className="font-semibold">+ Step</span> to add one at{" "}
            <span className="font-mono">{formatMs(currentSnap)}</span>.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sorted.map((s, idx) => {
              const isActive = s.tMs === currentSnap;
              return (
                <button
                  key={s.id}
                  className={[
                    "w-full rounded-2xl border px-3 py-3 text-left active:scale-[0.99]",
                    isActive ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white",
                  ].join(" ")}
                  onClick={() => {
                    setIsPlaying(false);
                    setTimeMs(s.tMs);
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">
                      {s.label?.trim() ? s.label : `Step ${idx + 1}`}
                    </div>
                    <div className="text-xs font-mono text-slate-600">{formatMs(s.tMs)}</div>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    x {Math.round(s.x)} · y {Math.round(s.y)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-3 pb-3">
        <button
          className="w-full rounded-2xl bg-white ring-1 ring-slate-200 px-3 py-2 text-sm active:scale-[0.99]"
          onClick={() => setSelectedBoatId(null)}
        >
          Change boat
        </button>
      </div>
    </div>
  );
}