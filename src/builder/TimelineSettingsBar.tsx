import React from "react";

type Props = {
  durationSeconds: number;
  fps: number;

  onDurationSecondsChange: (seconds: number) => void;
  onFpsChange: (fps: number) => void;
};

export default function TimelineSettingsBar({
  durationSeconds,
  fps,
  onDurationSecondsChange,
  onFpsChange,
}: Props) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-end gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="flex items-center gap-2 text-sm text-slate-700">
        <span className="text-slate-500">Duration</span>
        <input
          className="w-24 rounded-lg bg-white px-2 py-1 ring-1 ring-slate-200"
          type="number"
          value={durationSeconds}
          min={1}
          max={120}
          onChange={(e) =>
            onDurationSecondsChange(Number(e.target.value || 12))
          }
        />
        <span className="text-slate-500">s</span>
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-700">
        <span className="text-slate-500">FPS</span>
        <input
          className="w-20 rounded-lg bg-white px-2 py-1 ring-1 ring-slate-200"
          type="number"
          value={fps}
          min={12}
          max={120}
          onChange={(e) => onFpsChange(Number(e.target.value || 60))}
        />
      </div>
    </div>
  );
}
