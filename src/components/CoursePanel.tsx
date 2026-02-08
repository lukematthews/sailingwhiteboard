import React from "react";
import type { Mark, StartLine, Wind } from "../types";
import { uid } from "../lib/ids";
import { clamp } from "../lib/math";

type CoursePanelProps = {
  marks: Mark[];
  setMarks: React.Dispatch<React.SetStateAction<Mark[]>>;
  wind: Wind;
  setWind: React.Dispatch<React.SetStateAction<Wind>>;
  startLine: StartLine;
  setStartLine: React.Dispatch<React.SetStateAction<StartLine>>;
  boatsOptions: { id: string; label: string }[];
};

export default function CoursePanel({ marks, setMarks, wind, setWind, startLine, setStartLine, boatsOptions }: CoursePanelProps) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="text-xs font-medium text-slate-700">Course</div>

      <div className="mt-3 space-y-3">
        <div>
          <div className="text-xs text-slate-600">Wind (from)</div>
          <div className="mt-1 flex items-center gap-2">
            <input
              className="w-full"
              type="range"
              min={0}
              max={359}
              value={Math.round(wind.fromDeg) % 360}
              onChange={(e) => setWind((w) => ({ ...w, fromDeg: Number(e.target.value) }))}
            />
            <div className="w-12 text-right text-xs text-slate-700">{Math.round(wind.fromDeg) % 360}°</div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="text-xs text-slate-600">Speed</div>
            <input
              className="w-20 rounded-lg bg-white px-2 py-1 text-xs ring-1 ring-slate-200"
              type="number"
              min={0}
              max={60}
              value={wind.speedKt ?? 0}
              onChange={(e) => setWind((w) => ({ ...w, speedKt: clamp(Number(e.target.value || 0), 0, 60) }))}
            />
            <div className="text-xs text-slate-600">kt</div>
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-600">Start line</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
              <div className="font-medium text-slate-700">Committee</div>
              <div className="mt-1 text-slate-600">Drag square handle on canvas</div>
            </div>
            <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
              <div className="font-medium text-slate-700">Pin</div>
              <div className="mt-1 text-slate-600">Drag circle handle on canvas</div>
            </div>
          </div>

          <div className="mt-2">
            <div className="text-xs text-slate-600">Start boat</div>
            <select
              className="mt-1 w-full rounded-lg bg-white px-2 py-2 text-sm ring-1 ring-slate-200"
              value={startLine.startBoatId ?? ""}
              onChange={(e) => setStartLine((s) => ({ ...s, startBoatId: (e.target.value || null) as any }))}
            >
              <option value="">(none)</option>
              {boatsOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>

            <button
              className="mt-2 w-full rounded-lg bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
              onClick={() => {
                setStartLine((s) => ({ ...s, committee: { x: 380, y: 120 }, pin: { x: 660, y: 150 } }));
              }}
            >
              Reset start line
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-600">Marks</div>
            <button
              className="rounded-lg bg-white px-2 py-1 text-xs shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
              onClick={() =>
                setMarks((prev) => [
                  ...prev,
                  { id: uid(), name: `M${prev.length + 1}`, type: "round", x: 520 + (prev.length % 3) * 30, y: 120 + (prev.length % 3) * 30 },
                ])
              }
            >
              + Mark
            </button>
          </div>

          <div className="mt-2 space-y-1">
            {marks.length === 0 ? (
              <div className="text-xs text-slate-500">No marks yet. Add one, then drag on canvas.</div>
            ) : (
              marks.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg bg-white px-2 py-2 text-xs ring-1 ring-slate-200">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-700">{m.name}</div>
                    <div className="text-slate-500">{m.type}</div>
                  </div>
                  <button
                    className="rounded-md px-2 py-1 text-xs ring-1 ring-slate-200 hover:bg-slate-50"
                    onClick={() => setMarks((prev) => prev.filter((x) => x.id !== m.id))}
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* <div className="rounded-lg bg-white p-2 text-xs text-slate-600 ring-1 ring-slate-200">
          <div className="font-medium text-slate-700">Canvas interactions</div>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>Drag marks to position them.</li>
            <li>Drag start-line handles (square/circle) to set the line.</li>
            <li>Wind arrow is display-only for now.</li>
          </ul>
        </div> */}
      </div>
    </div>
  );
}
