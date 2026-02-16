import * as React from "react";
import { formatTime } from "../../lib/time";

import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import SkipPreviousIcon from "@mui/icons-material/SkipPrevious";

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

  const barRef = React.useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [barWidth, setBarWidth] = React.useState(0);

  // --- clamp ---
  const safeDuration =
    Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 1;

  const safeTime = Number.isFinite(timeMs)
    ? Math.min(safeDuration, Math.max(0, timeMs))
    : 0;

  // --- pixel progress ---
  const progressPx = barWidth > 0 ? (safeTime / safeDuration) * barWidth : 0;

  const thumbLeftPx = Math.max(0, Math.min(barWidth, progressPx)) - 8;

  const quantize = React.useCallback(
    (vMs: number) => {
      const step = Math.max(1, scrubberStep || 1);
      return Math.round(vMs / step) * step;
    },
    [scrubberStep],
  );

  const seekFromClientX = React.useCallback(
    (clientX: number) => {
      const el = barRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const w = rect.width || 1;

      const x = Math.min(w, Math.max(0, clientX - rect.left));
      const raw = (x / w) * safeDuration;

      onScrubTo(quantize(raw));
    },
    [safeDuration, onScrubTo, quantize],
  );

  // ResizeObserver keeps width correct
  React.useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;

    const update = () => setBarWidth(el.getBoundingClientRect().width);

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  // Drag handling
  React.useEffect(() => {
    if (!dragging) return;

    const onMove = (e: MouseEvent) => seekFromClientX(e.clientX);
    const onUp = () => setDragging(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, seekFromClientX]);

  return (
    <div className="col-span-3 border-b border-slate-800 bg-slate-950">
      <div className="px-3 py-3">
        <div className="rounded-2xl bg-slate-900/80 px-4 py-3 ring-1 ring-white/10">
          {/* ===================== */}
          {/* TOP: SCRUBBER */}
          {/* ===================== */}
          <div
            className="w-full"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <div
              ref={barRef}
              className={`relative w-full select-none ${
                dragging ? "cursor-grabbing" : "cursor-pointer"
              }`}
              style={{ height: 22 }}
              onMouseDown={(e) => {
                setDragging(true);
                seekFromClientX(e.clientX);
              }}
            >
              {/* Track */}
              <div
                className={`absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-full bg-white/20 ${
                  hovered || dragging ? "h-3" : "h-2.5"
                }`}
              />

              {/* Progress */}
              <div
                className={`absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-red-500 ${
                  hovered || dragging ? "h-3" : "h-2.5"
                }`}
                style={{ width: `${progressPx}px` }}
              />

              {/* Thumb */}
              <div
                className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-red-500 ring-2 ring-white shadow-md ${
                  hovered || dragging ? "opacity-100" : "opacity-0"
                }`}
                style={{
                  width: 16,
                  height: 16,
                  left: `${thumbLeftPx}px`,
                }}
              />
            </div>
          </div>

          {/* ===================== */}
          {/* BOTTOM: CONTROLS */}
          {/* ===================== */}
          <div className="mt-3 flex items-center gap-3">
            {/* Buttons */}
            <div className="flex items-center gap-2">
              <IconButton label="Back" onClick={onJumpStart}>
                <SkipPreviousIcon fontSize="medium" />
              </IconButton>

              <button
                onClick={onTogglePlay}
                type="button"
                className="flex h-10 items-center justify-center rounded-2xl bg-white px-5 text-slate-900 hover:bg-slate-200 active:scale-[0.98]"
              >
                {isPlaying ? (
                  <PauseIcon fontSize="medium" />
                ) : (
                  <PlayArrowIcon fontSize="medium" />
                )}
              </button>

              <IconButton label="Forward" onClick={onJumpEnd}>
                <SkipNextIcon fontSize="medium" />
              </IconButton>
            </div>

            {/* Time */}
            <div className="ml-2 text-xs font-medium text-slate-200 tabular-nums">
              {formatTime(safeTime)} <span className="text-slate-500">/</span>{" "}
              {formatTime(safeDuration)}
            </div>

            {/* Right Controls */}
            <div className="ml-auto flex items-center gap-2">
              {/* Speed */}
              <label className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-200 ring-1 ring-white/10">
                <span className="text-slate-400">Speed</span>
                <select
                  className="bg-transparent font-medium text-white outline-none"
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

              {/* Ripple */}
              <label className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-200 ring-1 ring-white/10">
                <input
                  type="checkbox"
                  checked={ripple}
                  onChange={(e) => setRipple(e.target.checked)}
                />
                Ripple
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- */
/* Icon Button Wrapper */
/* ----------------------------- */

function IconButton({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      type="button"
      className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-slate-200 ring-1 ring-white/10 hover:bg-white/10 active:scale-[0.98]"
    >
      {children}
    </button>
  );
}
