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

  // kept in case you still need it elsewhere; not used now
  boatsOptions: { id: string; label: string }[];
};

export default function CoursePanel({
  marks,
  setMarks,
  wind,
  setWind,
  startLine,
  setStartLine,
}: CoursePanelProps) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="text-xs font-medium text-slate-700">Course</div>

      <div className="mt-3 space-y-3">
        {/* Wind */}
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

        {/* Start line (handles on canvas) */}
        <div>
          <div className="text-xs text-slate-600">Start line</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
              <div className="font-medium text-slate-700">Committee</div>
              <div className="mt-1 text-slate-600">
                Drag square handle on canvas
              </div>
            </div>
            <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
              <div className="font-medium text-slate-700">Pin</div>
              <div className="mt-1 text-slate-600">
                Drag circle handle on canvas
              </div>
            </div>
          </div>

          <button
            className="mt-2 w-full rounded-lg bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
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
        </div>

        {/* Marks */}
        <div>
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-600">Marks</div>
            <button
              className="rounded-lg bg-white px-2 py-1 text-xs shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
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
                <MarkRow
                  key={m.id}
                  mark={m}
                  onRename={(nextName) =>
                    setMarks((prev) =>
                      prev.map((x) =>
                        x.id === m.id ? { ...x, name: nextName } : x,
                      ),
                    )
                  }
                  onDelete={() =>
                    setMarks((prev) => prev.filter((x) => x.id !== m.id))
                  }
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MarkRow({
  mark,
  onRename,
  onDelete,
}: {
  mark: Mark;
  onRename: (nextName: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-2 text-xs ring-1 ring-slate-200">
      <div className="min-w-0 flex-1">
        <input
          className="w-full min-w-0 rounded-md bg-transparent px-1 py-0.5 font-medium text-slate-700 outline-none ring-0 focus:bg-slate-50"
          value={mark.name}
          onChange={(e) => onRename(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          placeholder="Mark name"
        />
        <div className="px-1 text-slate-500">{mark.type}</div>
      </div>

      <button
        className="shrink-0 rounded-md px-2 py-1 text-xs ring-1 ring-slate-200 hover:bg-slate-50"
        onClick={onDelete}
        type="button"
      >
        Delete
      </button>
    </div>
  );
}
