import React from "react";
import type { Mark, StartLine, Wind } from "../types";
import { uid } from "../lib/ids";
import { clamp } from "../lib/math";
import { DEFAULT_START_LINE } from "../canvas/defaults";

type CoursePanelProps = {
  // Wind (always visible)
  wind: Wind;
  setWind: React.Dispatch<React.SetStateAction<Wind>>;

  // Visibility toggles
  showStartLine: boolean;
  setShowStartLine: React.Dispatch<React.SetStateAction<boolean>>;
  showMarks: boolean;
  setShowMarks: React.Dispatch<React.SetStateAction<boolean>>;

  // Start line (toggleable)
  startLine: StartLine;
  setStartLine: React.Dispatch<React.SetStateAction<StartLine>>;
  boatsOptions: { id: string; label: string }[];

  // Marks (toggleable)
  marks: Mark[];
  setMarks: React.Dispatch<React.SetStateAction<Mark[]>>;
};

export default function CoursePanel({
  wind,
  setWind,
  showStartLine,
  setShowStartLine,
  showMarks,
  setShowMarks,
  startLine,
  setStartLine,
  boatsOptions,
  marks,
  setMarks,
}: CoursePanelProps) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-slate-700">Course</div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg bg-white px-2 py-1 text-[11px] text-slate-700 ring-1 ring-slate-200">
            <input
              type="checkbox"
              checked={showStartLine}
              onChange={(e) => setShowStartLine(e.target.checked)}
            />
            Start line
          </label>

          <label className="flex items-center gap-2 rounded-lg bg-white px-2 py-1 text-[11px] text-slate-700 ring-1 ring-slate-200">
            <input
              type="checkbox"
              checked={showMarks}
              onChange={(e) => setShowMarks(e.target.checked)}
            />
            Marks
          </label>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {/* Wind (always visible) */}
        <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
          <div className="text-xs font-medium text-slate-700">Wind</div>

          <div className="mt-2">
            <div className="text-xs text-slate-600">From</div>
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
          </div>

          <div className="mt-2 flex items-center gap-2">
            <div className="text-xs text-slate-600">Speed</div>
            <input
              className="w-20 rounded-lg bg-slate-50 px-2 py-1 text-xs ring-1 ring-slate-200"
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

        {/* Start line (toggleable) */}
        <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-slate-700">Start line</div>
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] ring-1 ${
                showStartLine
                  ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                  : "bg-slate-50 text-slate-500 ring-slate-200"
              }`}
            >
              {showStartLine ? "Visible" : "Hidden"}
            </span>
          </div>

          {showStartLine ? (
            <>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-slate-50 p-2 ring-1 ring-slate-200">
                  <div className="font-medium text-slate-700">Committee</div>
                  <div className="mt-1 text-slate-600">
                    Drag square handle on canvas
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 p-2 ring-1 ring-slate-200">
                  <div className="font-medium text-slate-700">Pin</div>
                  <div className="mt-1 text-slate-600">
                    Drag circle handle on canvas
                  </div>
                </div>
              </div>

              {/* Start boat removed */}
              <button
                className="mt-2 w-full rounded-lg bg-slate-50 px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 hover:bg-slate-100"
                onClick={() => {
                  setStartLine((s) => ({
                    ...s,
                    ...DEFAULT_START_LINE,
                    startBoatId: null,
                  }));
                }}
                type="button"
              >
                Reset start line
              </button>
            </>
          ) : (
            <div className="mt-2 text-xs text-slate-500">
              Start line is hidden.
            </div>
          )}
        </div>

        {/* Marks (toggleable) */}
        <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-slate-700">Marks</div>

            <div className="flex items-center gap-2">
              <span
                className={`rounded-md px-2 py-0.5 text-[11px] ring-1 ${
                  showMarks
                    ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                    : "bg-slate-50 text-slate-500 ring-slate-200"
                }`}
              >
                {showMarks ? "Visible" : "Hidden"}
              </span>

              <button
                className="rounded-lg bg-slate-50 px-2 py-1 text-xs shadow-sm ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50"
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
                title={!showMarks ? "Enable Marks to add" : "Add mark"}
              >
                + Mark
              </button>
            </div>
          </div>

          {showMarks ? (
            <div className="mt-2 space-y-1">
              {marks.length === 0 ? (
                <div className="text-xs text-slate-500">
                  No marks yet. Add one, then drag on canvas.
                </div>
              ) : (
                marks.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-2 text-xs ring-1 ring-slate-200"
                  >
                    <input
                      className="min-w-0 flex-1 rounded-md bg-white px-2 py-1 text-xs ring-1 ring-slate-200"
                      value={m.name}
                      onChange={(e) => {
                        const v = e.target.value;
                        setMarks((prev) =>
                          prev.map((x) =>
                            x.id === m.id ? { ...x, name: v } : x,
                          ),
                        );
                      }}
                      placeholder="Mark name"
                    />

                    <span className="shrink-0 rounded-md bg-white px-2 py-1 text-[11px] text-slate-600 ring-1 ring-slate-200">
                      {m.type}
                    </span>

                    <button
                      className="shrink-0 rounded-md px-2 py-1 text-xs ring-1 ring-slate-200 hover:bg-white"
                      onClick={() =>
                        setMarks((prev) => prev.filter((x) => x.id !== m.id))
                      }
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="mt-2 text-xs text-slate-500">Marks are hidden.</div>
          )}
        </div>
      </div>
    </div>
  );
}
