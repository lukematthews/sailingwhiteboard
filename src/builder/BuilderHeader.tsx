import React from "react";
import type { ToolMode } from "../types";

type Props = {
  tool: ToolMode;
  setTool: (t: ToolMode) => void;

  snapToGrid: boolean;
  setSnapToGrid: (v: boolean) => void;

  selectedBoatId: string | null;

  onAddBoat: () => void;
  onDeleteSelectedBoat: () => void;
};

export default function BuilderHeader({
  tool,
  setTool,
  snapToGrid,
  setSnapToGrid,
  selectedBoatId,
  onAddBoat,
  onDeleteSelectedBoat,
}: Props) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Sailing Whiteboard
        </h1>
        <p className="text-sm text-slate-600">
          Show them what happened out there!
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          className="rounded-2xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
          onClick={onAddBoat}
        >
          + Boat
        </button>

        <button
          className="rounded-2xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
          onClick={onDeleteSelectedBoat}
          disabled={!selectedBoatId}
        >
          Delete
        </button>

        <button
          className={`rounded-2xl px-3 py-2 text-sm shadow-sm ring-1 ${
            tool === "select"
              ? "bg-slate-900 text-white ring-slate-900"
              : "bg-white text-slate-900 ring-slate-200 hover:bg-slate-50"
          }`}
          onClick={() => setTool("select")}
        >
          Drag
        </button>

        <button
          className={`rounded-2xl px-3 py-2 text-sm shadow-sm ring-1 ${
            tool === "rotate"
              ? "bg-slate-900 text-white ring-slate-900"
              : "bg-white text-slate-900 ring-slate-200 hover:bg-slate-50"
          }`}
          onClick={() => setTool("rotate")}
        >
          Rotate
        </button>

        <label className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200">
          <input
            type="checkbox"
            checked={snapToGrid}
            onChange={(e) => setSnapToGrid(e.target.checked)}
          />
          Snap
        </label>
      </div>
    </div>
  );
}
