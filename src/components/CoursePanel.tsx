import React from "react";
import type { Mark, StartLine, Wind } from "../types";
import { uid } from "../lib/ids";
import { clamp } from "../lib/math";
import { DEFAULT_START_LINE } from "../canvas/defaults";

type CoursePanelProps = {
  marks: Mark[];
  setMarks: React.Dispatch<React.SetStateAction<Mark[]>>;

  wind: Wind;
  setWind: React.Dispatch<React.SetStateAction<Wind>>;

  startLine: StartLine;
  setStartLine: React.Dispatch<React.SetStateAction<StartLine>>;

  // visibility controls
  showStartLine: boolean;
  setShowStartLine: React.Dispatch<React.SetStateAction<boolean>>;

  showMarks: boolean;
  setShowMarks: React.Dispatch<React.SetStateAction<boolean>>;

  // overlays
  showMarkThreeBL: boolean;
  setShowMarkThreeBL: React.Dispatch<React.SetStateAction<boolean>>;

  showBoatTransomLines: boolean;
  setShowBoatTransomLines: React.Dispatch<React.SetStateAction<boolean>>;

  boatsOptions: { id: string; label: string }[];
};

export default function CoursePanel({
  marks,
  setMarks,
  wind,
  setWind,
  startLine,
  setStartLine,
  showStartLine,
  setShowStartLine,
  showMarks,
  setShowMarks,
  showMarkThreeBL,
  setShowMarkThreeBL,
  showBoatTransomLines,
  setShowBoatTransomLines,
}: CoursePanelProps) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="text-xs font-medium text-slate-700">Course</div>

      <div className="mt-3 space-y-3">
        {/* WIND (always visible) */}
        <div>
          <div className="text-xs text-slate-600">Wind (from)</div>
          <div className="mt-1 flex items-center gap-2">
            <input
              className="w-full"
              type="range"
              min={0}
              max={359}
              value={Math.round(wind.fromDeg) % 360}
              onChange={(e) =>
                setWind((w) => ({ ...w, fromDeg: Number(e.target.value) }))
              }
            />
            <div className="w-12 text-right text-xs text-slate-700">
              {Math.round(wind.fromDeg) % 360}°
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="text-xs text-slate-600">Speed</div>
            <input
              className="w-20 rounded-lg bg-white px-2 py-1 text-xs ring-1 ring-slate-200"
              type="number"
              min={0}
              max={60}
              value={wind.speedKt ?? 0}
              onChange={(e) =>
                setWind((w) => ({
                  ...w,
                  speedKt: clamp(Number(e.target.value || 0), 0, 60),
                }))
              }
            />
            <div className="text-xs text-slate-600">kt</div>
          </div>
        </div>

        {/* VISIBILITY / OVERLAYS */}
        <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
          <div className="text-xs font-medium text-slate-700">Overlays</div>

          <div className="mt-2 space-y-2">
            <label className="flex items-center justify-between gap-2 text-xs text-slate-700">
              <span>Show start line</span>
              <input
                type="checkbox"
                checked={showStartLine}
                onChange={(e) => setShowStartLine(e.target.checked)}
              />
            </label>

            <label className="flex items-center justify-between gap-2 text-xs text-slate-700">
              <span>Show marks</span>
              <input
                type="checkbox"
                checked={showMarks}
                onChange={(e) => setShowMarks(e.target.checked)}
              />
            </label>

            <label className="flex items-center justify-between gap-2 text-xs text-slate-700">
              <span>3 boat-length circle on marks</span>
              <input
                type="checkbox"
                checked={showMarkThreeBL}
                onChange={(e) => setShowMarkThreeBL(e.target.checked)}
                disabled={!showMarks}
                title={
                  !showMarks ? "Enable marks to see the circles" : undefined
                }
              />
            </label>

            <label className="flex items-center justify-between gap-2 text-xs text-slate-700">
              <span>Transom overlap lines on boats</span>
              <input
                type="checkbox"
                checked={showBoatTransomLines}
                onChange={(e) => setShowBoatTransomLines(e.target.checked)}
              />
            </label>
          </div>
        </div>

        {/* START LINE */}
        <div className={showStartLine ? "" : "opacity-60"}>
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-600">Start line</div>
            <button
              className="rounded-lg bg-white px-2 py-1 text-xs shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
              onClick={() => {
                setStartLine((s) => ({
                  ...s,
                  ...DEFAULT_START_LINE,
                  startBoatId: null,
                }));
              }}
              type="button"
              disabled={!showStartLine}
              title={!showStartLine ? "Enable start line to edit" : undefined}
            >
              Reset
            </button>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
              <div className="font-medium text-slate-700">Committee</div>
              <div className="mt-1 text-slate-600">Drag square handle</div>
            </div>
            <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
              <div className="font-medium text-slate-700">Pin</div>
              <div className="mt-1 text-slate-600">Drag circle handle</div>
            </div>
          </div>
        </div>

        {/* MARKS */}
        <div className={showMarks ? "" : "opacity-60"}>
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-600">Marks</div>
            <button
              className="rounded-lg bg-white px-2 py-1 text-xs shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
              onClick={() =>
                setMarks((prev) => [
                  ...prev,
                  {
                    id: uid(),
                    name: `M${prev.length + 1}`,
                    type: "round",
                    x: 520 + (prev.length % 3) * 30,
                    y: 120 + (prev.length % 3) * 30,
                  },
                ])
              }
              type="button"
              disabled={!showMarks}
            >
              + Mark
            </button>
          </div>

          <div className="mt-2 space-y-1">
            {marks.length === 0 ? (
              <div className="text-xs text-slate-500">
                No marks yet. Add one, then drag on canvas.
              </div>
            ) : (
              marks.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 rounded-lg bg-white px-2 py-2 text-xs ring-1 ring-slate-200"
                >
                  <div className="min-w-0 flex-1">
                    <input
                      className="w-full rounded-md bg-white px-2 py-1 text-xs ring-1 ring-slate-200"
                      value={m.name ?? ""}
                      disabled={!showMarks}
                      onChange={(e) => {
                        const v = e.target.value;
                        setMarks((prev) =>
                          prev.map((x) =>
                            x.id === m.id ? { ...x, name: v } : x,
                          ),
                        );
                      }}
                    />
                    <div className="mt-1 text-slate-500">{m.type}</div>
                  </div>

                  <button
                    className="shrink-0 rounded-md px-2 py-1 text-xs ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
                    onClick={() =>
                      setMarks((prev) => prev.filter((x) => x.id !== m.id))
                    }
                    type="button"
                    disabled={!showMarks}
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
