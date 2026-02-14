import { Slider } from "antd";
import { formatTime } from "../../lib/time";

export default function AudioScrubberBar(props: {
  timeMs: number;
  durationMs: number;
  scrubberStep: number;

  onScrubTo: (t: number) => void;
  onJumpStart: () => void;
  onTogglePlay: () => void;
  onJumpEnd: () => void;

  isPlaying: boolean;

  playbackRate: number;
  setPlaybackRate: (r: number) => void;

  ripple: boolean;
  setRipple: (v: boolean) => void;
}) {
  const {
    timeMs,
    durationMs,
    scrubberStep,
    onScrubTo,
    onJumpStart,
    onTogglePlay,
    onJumpEnd,
    isPlaying,
    playbackRate,
    setPlaybackRate,
    ripple,
    setRipple,
  } = props;

  return (
    <div className="col-span-3 border-b border-slate-200 bg-slate-50">
      <div className="px-2 py-2">
        <div className="audio-scrubber flex items-center gap-2 rounded-xl bg-white px-2 py-2 ring-1 ring-slate-200">
          {/* left controls (inside the bar) */}
          <div className="flex items-center gap-1">
            <button
              className="h-9 w-9 rounded-lg bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
              onClick={onJumpStart}
              title="Start"
              type="button"
            >
              ⏮
            </button>

            <button
              className="h-9 w-16 rounded-lg bg-slate-900 text-white ring-1 ring-slate-900 hover:bg-slate-800"
              onClick={onTogglePlay}
              title={isPlaying ? "Pause" : "Play"}
              type="button"
            >
              {isPlaying ? "Pause" : "Play"}
            </button>

            <button
              className="h-9 w-9 rounded-lg bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
              onClick={onJumpEnd}
              title="End"
              type="button"
            >
              ⏭
            </button>
          </div>

          {/* time left */}
          <div className="ml-1 w-[84px] shrink-0 text-xs font-medium text-slate-700 tabular-nums">
            {formatTime(timeMs)}
          </div>

          {/* slider */}
            <div className="min-w-0 flex-1 px-1">
            <Slider
                className="audio-scrubber-slider w-full"
                style={{ width: "100%", maxWidth: "none" }}
                min={0}
                max={Math.max(1, durationMs)}
                step={scrubberStep}
                value={Math.round(timeMs)}
                onChange={(v) => onScrubTo(Number(v))}
                tooltip={{ formatter: (v) => (typeof v === "number" ? formatTime(v) : "") }}
            />
            </div>

          {/* time right */}
          <div className="w-[84px] shrink-0 text-right text-xs font-medium text-slate-700 tabular-nums">
            {formatTime(durationMs)}
          </div>

          {/* speed + ripple */}
          <div className="ml-1 flex items-center gap-2">
            <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-2 text-xs text-slate-700 ring-1 ring-slate-200">
              <span className="text-slate-500">Speed</span>
              <select
                className="bg-transparent font-medium text-slate-800 outline-none"
                value={String(playbackRate)}
                onChange={(e) => setPlaybackRate(Number(e.target.value))}
              >
                <option value="0.5">0.5×</option>
                <option value="0.75">0.75×</option>
                <option value="1">1×</option>
                <option value="1.25">1.25×</option>
                <option value="1.5">1.5×</option>
                <option value="2">2×</option>
              </select>
            </label>

            <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-2 text-xs text-slate-700 ring-1 ring-slate-200">
              <input type="checkbox" checked={ripple} onChange={(e) => setRipple(e.target.checked)} />
              Ripple
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
