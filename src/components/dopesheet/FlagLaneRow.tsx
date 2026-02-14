import { Slider } from "antd";
import { formatTime, snapTime } from "../../lib/time";
import { Flag, FlagCodeClip } from "../../types";

export default function FlagLaneRow(props: {
  flag: Flag;
  clips: FlagCodeClip[];

  selectedFlagId: string | null;
  selectedClipId: string | null;

  timeMs: number;
  fps: number;
  durationMs: number;
  stepMs: number;

  onSelectFlag: (flagId: string) => void;
  onSelectClip: (flagId: string, clipId: string) => void;

  onDeleteClip: (flagId: string, clipId: string) => void;
  onAddClipAtPlayhead: (flagId: string) => void;

  /** ✅ NEW: update range for a specific clip */
  onClipRangeChange: (
    flagId: string,
    clipId: string,
    range: [number, number]
  ) => void;
}) {
  const {
    flag,
    clips,
    selectedFlagId,
    selectedClipId,
    timeMs,
    fps,
    durationMs,
    stepMs,
    onSelectFlag,
    onSelectClip,
    onDeleteClip,
    onAddClipAtPlayhead,
    onClipRangeChange,
  } = props;

  const isFlagSelected = selectedFlagId === flag.id;

  return (
    <div className="col-span-3 border-b border-slate-200 last:border-b-0">
      <div className="grid grid-cols-[140px_minmax(0,1fr)_88px] items-start">
        {/* ===================================================== */}
        {/* LEFT: Flag label */}
        {/* ===================================================== */}
        <div className="px-2 py-3">
          <button
            className={`rounded-lg px-2 py-1 text-xs ring-1 ${
              isFlagSelected
                ? "bg-slate-900 text-white ring-slate-900"
                : "bg-slate-50 text-slate-800 ring-slate-200 hover:bg-slate-100"
            }`}
            onClick={() => onSelectFlag(flag.id)}
            type="button"
            title="Select flag"
          >
            Flag {flag.code}
          </button>
        </div>

        {/* ===================================================== */}
        {/* MIDDLE: Clips + Sliders */}
        {/* ===================================================== */}
        <div className="min-w-0 px-2 py-3">
          <div className="grid gap-2 min-w-0">
            {/* ----------------------------- */}
            {/* Clip pills row */}
            {/* ----------------------------- */}
            <div className="min-w-0 flex items-center gap-1 overflow-x-auto whitespace-nowrap">
              {clips.length === 0 ? (
                <div className="text-[11px] text-slate-500">No clips</div>
              ) : (
                clips.map((c, i) => {
                  const isSelected = c.id === selectedClipId;
                  const isActiveNow = timeMs >= c.startMs && timeMs <= c.endMs;
                  const atPlayhead =
                    Math.abs(snapTime(timeMs, fps) - c.startMs) < 1;

                  return (
                    <button
                      key={c.id}
                      onClick={() => onSelectClip(flag.id, c.id)}
                      className={`group relative shrink-0 rounded-md px-2 py-1 text-[11px] ring-1 ${
                        isSelected
                          ? "bg-slate-900 text-white ring-slate-900"
                          : isActiveNow
                          ? "bg-blue-50 text-blue-900 ring-blue-200 hover:bg-blue-100"
                          : atPlayhead
                          ? "bg-emerald-50 text-emerald-900 ring-emerald-200 hover:bg-emerald-100"
                          : "bg-slate-50 text-slate-800 ring-slate-200 hover:bg-slate-100"
                      }`}
                      title={`Clip ${i + 1}: ${c.code} (${formatTime(
                        c.startMs
                      )} → ${formatTime(c.endMs)})`}
                      type="button"
                    >
                      {c.code}
                      <span className="ml-1 text-[10px] opacity-60">
                        {formatTime(c.startMs)}–{formatTime(c.endMs)}
                      </span>

                      {/* delete */}
                      <button
                        className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded bg-white text-[10px] text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 group-hover:flex"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onDeleteClip(flag.id, c.id);
                        }}
                        title="Delete clip"
                        type="button"
                      >
                        ×
                      </button>
                    </button>
                  );
                })
              )}
            </div>

            {/* ----------------------------- */}
            {/* One slider per clip */}
            {/* ----------------------------- */}
            <div className="space-y-2 min-w-0">
              {clips.length === 0 ? (
                <div className="h-[22px] rounded-md bg-slate-50 ring-1 ring-slate-200" />
              ) : (
                clips.map((clip) => {
                  const isSelected = clip.id === selectedClipId;

                  return (
                    <div
                      key={clip.id}
                      className={`rounded-md px-2 py-1 ring-1 ${
                        isSelected
                          ? "bg-white ring-slate-400"
                          : "bg-slate-50 ring-slate-200"
                      }`}
                    >
                      <Slider
                        className="flag-range-slider w-full"
                        style={{ width: "100%", maxWidth: "none" }}
                        range
                        min={0}
                        max={Math.max(1, durationMs)}
                        step={stepMs}
                        value={[clip.startMs, clip.endMs]}
                        onChange={(v) => {
                          const arr = v as number[];

                          // Update this specific clip
                          onClipRangeChange(flag.id, clip.id, [
                            Number(arr[0]),
                            Number(arr[1]),
                          ]);

                          // Auto-select when dragged
                          onSelectClip(flag.id, clip.id);
                        }}
                        tooltip={{
                          formatter: (v) =>
                            typeof v === "number" ? formatTime(v) : "",
                        }}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ===================================================== */}
        {/* RIGHT: Add Clip button */}
        {/* ===================================================== */}
        <div className="px-2 py-3">
          <div className="flex justify-end">
            <button
              className="h-8 rounded-lg bg-slate-50 px-2 text-xs ring-1 ring-slate-200 hover:bg-slate-100"
              onClick={() => onAddClipAtPlayhead(flag.id)}
              type="button"
            >
              + Clip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}