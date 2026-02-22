// src/builder/InspectorPanel.tsx
import React from "react";
import type { Boat } from "../types";

type Props = {
  selectedBoatId: string | null;
  selectedBoat: Boat | null;

  onUpdateSelectedBoat: (patch: Partial<Boat>) => void;

  displayedForInspector: Boat | null;
  stepsCountForSelectedBoat: number;
};

export default function InspectorPanel({
  selectedBoatId,
  selectedBoat,
  onUpdateSelectedBoat,
  displayedForInspector,
  stepsCountForSelectedBoat,
}: Props) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-sm font-semibold text-slate-900">Selection</h2>
      <p className="mt-1 text-xs text-slate-600">
        Double-tap to select. Long-press to drag.
      </p>

      <div className="mt-3 space-y-3">
        <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <div className="text-xs font-medium text-slate-700">
            Selected Boat
          </div>

          {!selectedBoatId || !selectedBoat ? (
            <div className="mt-2 text-sm text-slate-600">No boat selected.</div>
          ) : (
            <div className="mt-2 space-y-3">
              <label className="block">
                <div className="text-xs text-slate-600">Label</div>
                <input
                  className="mt-1 w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-200"
                  value={selectedBoat.label}
                  onChange={(e) =>
                    onUpdateSelectedBoat({ label: e.target.value })
                  }
                />
              </label>

              <label className="block">
                <div className="text-xs text-slate-600">Color</div>
                <input
                  className="mt-1 h-10 w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-200"
                  type="color"
                  value={selectedBoat.color}
                  onChange={(e) =>
                    onUpdateSelectedBoat({ color: e.target.value })
                  }
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <div className="text-xs text-slate-600">X</div>
                  <input
                    className="mt-1 w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-200"
                    type="number"
                    value={Math.round(selectedBoat.x)}
                    onChange={(e) =>
                      onUpdateSelectedBoat({ x: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="block">
                  <div className="text-xs text-slate-600">Y</div>
                  <input
                    className="mt-1 w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-200"
                    type="number"
                    value={Math.round(selectedBoat.y)}
                    onChange={(e) =>
                      onUpdateSelectedBoat({ y: Number(e.target.value) })
                    }
                  />
                </label>
              </div>

              <label className="block">
                <div className="text-xs text-slate-600">Heading (deg)</div>
                <input
                  className="mt-1 w-full"
                  type="range"
                  min={0}
                  max={359}
                  step={1}
                  value={Math.round(selectedBoat.headingDeg) % 360}
                  onChange={(e) =>
                    onUpdateSelectedBoat({ headingDeg: Number(e.target.value) })
                  }
                />
                <div className="mt-1 text-xs text-slate-600">
                  {Math.round(selectedBoat.headingDeg) % 360}°
                </div>
              </label>

              <div className="rounded-lg bg-white p-2 text-xs text-slate-700 ring-1 ring-slate-200">
                <div className="font-medium text-slate-800">
                  Displayed at current time
                </div>
                {displayedForInspector ? (
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <div>x: {displayedForInspector.x.toFixed(1)}</div>
                    <div>y: {displayedForInspector.y.toFixed(1)}</div>
                    <div>
                      hdg: {displayedForInspector.headingDeg.toFixed(1)}°
                    </div>
                    <div>steps: {stepsCountForSelectedBoat}</div>
                  </div>
                ) : null}
                <div className="mt-2 text-[11px] text-slate-500">
                  Timing edits (steps) live in the Dopesheet. This panel is for
                  boat properties and selection.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* If you later add selectedMarkId/selectedStartHandle, this is where those go */}
      </div>
    </div>
  );
}
