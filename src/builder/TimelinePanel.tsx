// src/builder/TimelinePanel.tsx
import { clamp } from "../lib/math";

export default function TimelinePanel(props: {
  durationMs: number;
  setDurationMs: (ms: number) => void;

  fps: number;
  setFps: (fps: number) => void;

  timeMs: number;
  setTimeMs: (t: number | ((prev: number) => number)) => void;

  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;
}) {
  const { durationMs, setDurationMs, fps, setFps, timeMs, setTimeMs, isPlaying, setIsPlaying } =
    props;

  const durationSeconds = Math.round(durationMs / 1000);

  return (
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-slate-700">Timeline</div>
        {isPlaying ? (
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200">
            Playing
          </span>
        ) : (
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200">
            Paused
          </span>
        )}
      </div>

      <div className="mt-3 space-y-3">
        {/* Duration */}
        <div>
          <div className="text-xs text-slate-600">Duration</div>
          <div className="mt-1 flex items-center gap-2">
            <input
              className="w-24 rounded-lg bg-white px-2 py-1 text-sm ring-1 ring-slate-200"
              type="number"
              min={1}
              max={120}
              value={durationSeconds}
              onChange={(e) => {
                const s = clamp(Number(e.target.value || 1), 1, 120);
                const ms = s * 1000;
                setDurationMs(ms);
                setTimeMs((t: number) => clamp(t, 0, ms));
              }}
            />
            <div className="text-xs text-slate-600">seconds</div>

            <button
              type="button"
              className="ml-auto rounded-lg bg-white px-2 py-1 text-xs shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
              onClick={() => {
                setIsPlaying(false);
                setTimeMs(0);
              }}
            >
              Jump start
            </button>
          </div>
        </div>

        {/* FPS */}
        <div>
          <div className="text-xs text-slate-600">FPS</div>
          <div className="mt-1 flex items-center gap-2">
            <select
              className="w-full rounded-lg bg-white px-2 py-2 text-sm ring-1 ring-slate-200"
              value={String(fps)}
              onChange={(e) => setFps(clamp(Number(e.target.value), 12, 120))}
            >
              {[12, 15, 24, 25, 30, 48, 50, 60, 90, 120].map((v) => (
                <option key={v} value={v}>
                  {v} fps
                </option>
              ))}
            </select>

            <button
              type="button"
              className="rounded-lg bg-white px-2 py-2 text-xs shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
              onClick={() => {
                setIsPlaying(false);
                setTimeMs((t: number) => clamp(t, 0, durationMs));
              }}
              title="Clamp time + pause"
            >
              Pause
            </button>
          </div>
        </div>

        {/* Quick scrub */}
        <div>
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-600">Time</div>
            <div className="text-xs text-slate-500">{Math.round(timeMs)}ms</div>
          </div>

          <input
            className="mt-1 w-full"
            type="range"
            min={0}
            max={Math.max(1, durationMs)}
            value={Math.max(0, Math.min(durationMs, timeMs))}
            onMouseDown={() => setIsPlaying(false)}
            onChange={(e) => {
              setIsPlaying(false);
              setTimeMs(Number(e.target.value));
            }}
          />
        </div>
      </div>
    </div>
  );
}