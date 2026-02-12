// src/components/TimelineDopeSheet.tsx
//
// Multi-thumb slider UX (React Aria) for boat keyframes
// + Separate time ruler above the lanes for scrubbing playhead time.

import React from "react";
import { Slider, SliderTrack, SliderThumb } from "react-aria-components";
import { formatTime, xToMs } from "../lib/time";
import { clamp } from "../lib/math";
import { deleteKeyframeAt } from "../animation/keyframes";
import type {
  Boat,
  Flag,
  FlagCodeClip,
  FlagClipsByFlagId,
  KeyframesByBoatId,
} from "../types";

type SelectedKf = { kind: "kf"; boatId: string; idx: number };
type SelectedClip = { kind: "clip"; flagId: string; clipId: string };

type Props = {
  boats: Boat[];
  keyframesByBoatId: KeyframesByBoatId;

  // Option A additions
  flags: Flag[];
  flagClipsByFlagId: FlagClipsByFlagId;
  setFlagClipsByFlagId: React.Dispatch<React.SetStateAction<FlagClipsByFlagId>>;
  selectedFlagId: string | null;
  setSelectedFlagId: (id: string | null) => void;

  timeMs: number;
  durationMs: number;
  fps: number;

  selectedBoatId: string | null;
  setSelectedBoatId: (id: string | null) => void;

  setTimeMs: (t: number) => void;
  setIsPlaying: (v: boolean) => void;
  setKeyframesByBoatId: React.Dispatch<React.SetStateAction<KeyframesByBoatId>>;

  autoKey: boolean;
  setAutoKey: (v: boolean) => void;
};

type ActiveDrag = { boatId: string; idx: number } | null;

export default function TimelineDopeSheet({
  boats,
  keyframesByBoatId,

  flags,
  flagClipsByFlagId,
  setFlagClipsByFlagId,
  selectedFlagId,
  setSelectedFlagId,

  timeMs,
  durationMs,
  fps,

  selectedBoatId,
  setSelectedBoatId,

  setTimeMs,
  setIsPlaying,
  setKeyframesByBoatId,

  autoKey,
  setAutoKey,
}: Props) {
  const trackRef = React.useRef<HTMLDivElement | null>(null);

  const [selected, setSelected] = React.useState<SelectedKf | SelectedClip | null>(null);

  // which keyframe thumb is currently being dragged (so we can update playhead during drag)
  const activeDragRef = React.useRef<ActiveDrag>(null);

  // ─────────────────────────────
  // Snapping: integer frame index
  // ─────────────────────────────
  const frameMs = React.useMemo(() => 1000 / fps, [fps]);
  const maxFrame = React.useMemo(
    () => Math.max(0, Math.round(durationMs / frameMs)),
    [durationMs, frameMs],
  );

  const msToFrame = React.useCallback(
    (tMs: number) => clamp(Math.round(tMs / frameMs), 0, maxFrame),
    [frameMs, maxFrame],
  );

  const frameToMs = React.useCallback(
    (f: number) => clamp(Math.round(f) * frameMs, 0, durationMs),
    [frameMs, durationMs],
  );

  // ─────────────────────────────
  // Time ruler (scrub playhead)
  // - clicking/dragging on ruler changes time only
  // ─────────────────────────────
  const scrubToClientX = React.useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const r = trackRef.current.getBoundingClientRect();
      const x = clientX - r.left;
      const t = clamp(xToMs(x, durationMs, r.width), 0, durationMs);
      const snapped = frameToMs(msToFrame(t));
      setIsPlaying(false);
      setTimeMs(snapped);
    },
    [durationMs, frameToMs, msToFrame, setIsPlaying, setTimeMs],
  );

  const rulerDragRef = React.useRef<{ active: boolean } | null>(null);

  const onRulerPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    e.stopPropagation();
    scrubToClientX(e.clientX);
    rulerDragRef.current = { active: true };
    try {
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const onRulerPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!rulerDragRef.current?.active) return;
    e.stopPropagation();
    scrubToClientX(e.clientX);
  };

  const onRulerPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!rulerDragRef.current) return;
    rulerDragRef.current = null;
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Ruler tick marks (simple, stable)
  const ticks = React.useMemo(() => {
    // target ~6-10 labels depending on duration
    const seconds = Math.max(1, Math.round(durationMs / 1000));
    const step =
      seconds <= 10 ? 1 :
      seconds <= 20 ? 2 :
      seconds <= 40 ? 5 :
      10;

    const out: number[] = [];
    for (let s = 0; s <= seconds; s += step) out.push(s * 1000);
    if (out[out.length - 1] !== durationMs) out.push(durationMs);
    return out;
  }, [durationMs]);

  // ─────────────────────────────
  // Boat lanes as multi-thumb sliders
  // ─────────────────────────────
  const clampFramesBetweenNeighbors = React.useCallback(
    (currentFrames: number[], incomingFrames: number[]) => {
      const n = currentFrames.length;
      if (incomingFrames.length !== n) return currentFrames;

      const next = [...incomingFrames];

      for (let i = 0; i < n; i++) {
        const prev = i === 0 ? 0 : currentFrames[i - 1] + 1;
        const nxt = i === n - 1 ? maxFrame : currentFrames[i + 1] - 1;
        next[i] = clamp(Math.round(next[i]), prev, nxt);
      }

      for (let i = 1; i < n; i++) {
        if (next[i] <= next[i - 1]) next[i] = clamp(next[i - 1] + 1, 0, maxFrame);
      }

      return next;
    },
    [maxFrame],
  );

  const setBoatFrames = React.useCallback(
    (boatId: string, nextFrames: number[]) => {
      setKeyframesByBoatId((prev) => {
        const list = prev[boatId] || [];
        if (list.length !== nextFrames.length) return prev;

        const nextList = list.map((kf, i) => ({ ...kf, tMs: frameToMs(nextFrames[i]) }));
        return { ...prev, [boatId]: nextList };
      });
    },
    [frameToMs, setKeyframesByBoatId],
  );

  // ─────────────────────────────
  // Flag clips dragging (unchanged)
  // ─────────────────────────────
  const dragClipRef = React.useRef<{
    flagId: string;
    clipId: string;
    rect: DOMRect;
    lenMs: number;
    grabOffsetMs: number;
  } | null>(null);

  const onFlagLaneClick = (flagId: string) => {
    setSelectedBoatId(null);
    setSelectedFlagId(flagId);
    setSelected(null);
    activeDragRef.current = null;
  };

  const onClipPointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    flagId: string,
    clip: FlagCodeClip,
  ) => {
    e.stopPropagation();
    setSelectedBoatId(null);
    setSelectedFlagId(flagId);
    setSelected({ kind: "clip", flagId, clipId: clip.id });
    setIsPlaying(false);
    activeDragRef.current = null;

    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const pointerT = frameToMs(msToFrame(xToMs(x, durationMs, rect.width)));

    const lenMs = Math.max(0, clip.endMs - clip.startMs);
    const grabOffsetMs = clamp(pointerT - clip.startMs, 0, lenMs);

    dragClipRef.current = { flagId, clipId: clip.id, rect, lenMs, grabOffsetMs };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const onClipPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragClipRef.current) return;
    const { flagId, clipId, rect, lenMs, grabOffsetMs } = dragClipRef.current;

    const x = e.clientX - rect.left;
    const pointerT = frameToMs(msToFrame(xToMs(x, durationMs, rect.width)));

    let newStart = Math.round(pointerT - grabOffsetMs);
    newStart = clamp(newStart, 0, durationMs);

    let newEnd = Math.round(newStart + lenMs);
    if (newEnd > durationMs) {
      newEnd = durationMs;
      newStart = Math.max(0, newEnd - lenMs);
    }

    setTimeMs(pointerT);

    setFlagClipsByFlagId((prev) => {
      const list = prev[flagId] ? [...prev[flagId]] : [];
      const idx = list.findIndex((c) => c.id === clipId);
      if (idx === -1) return prev;

      list[idx] = { ...list[idx], startMs: newStart, endMs: newEnd };
      list.sort((a, b) => a.startMs - b.startMs);
      return { ...prev, [flagId]: list };
    });
  };

  const onClipPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    dragClipRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  // ─────────────────────────────
  // Delete selection (kf or clip)
  // - Do NOT allow deleting t=0 keyframe
  // ─────────────────────────────
  React.useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key !== "Delete" && ev.key !== "Backspace") return;
      if (!selected) return;

      if (selected.kind === "kf") {
        const list = keyframesByBoatId[selected.boatId] || [];
        const kf = list[selected.idx];
        if (!kf) return;

        if (msToFrame(kf.tMs) === 0) return;

        setKeyframesByBoatId((prev) => deleteKeyframeAt(prev, selected.boatId, kf.tMs));
        setSelected(null);
        activeDragRef.current = null;
        return;
      }

      if (selected.kind === "clip") {
        const { flagId, clipId } = selected;
        setFlagClipsByFlagId((prev) => {
          const list = prev[flagId] ? [...prev[flagId]] : [];
          const next = list.filter((c) => c.id !== clipId);
          return { ...prev, [flagId]: next };
        });
        setSelected(null);
        activeDragRef.current = null;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, keyframesByBoatId, msToFrame, setKeyframesByBoatId, setFlagClipsByFlagId]);

  // layout: boats + flags
  const boatRowCount = boats.length;
  const flagRowCount = flags.length;
  const totalRows = Math.max(boatRowCount + flagRowCount, 3);

  const rowHeight = 42;
  const topPad = 8;

  return (
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-slate-800">Timeline</div>
        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input type="checkbox" checked={autoKey} onChange={(e) => setAutoKey(e.target.checked)} />
          Auto-key
        </label>
      </div>

      <div className="grid grid-cols-[180px_1fr] gap-2">
        {/* Left labels */}
        <div className="space-y-1">
          {boats.map((b) => (
            <button
              key={b.id}
              onClick={() => {
                setSelectedBoatId(b.id);
                setSelectedFlagId(null);
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm ring-1 ${
                b.id === selectedBoatId
                  ? "bg-white ring-slate-300"
                  : "bg-transparent ring-transparent hover:bg-white/60"
              }`}
            >
              <span className="h-3 w-3 rounded-full" style={{ background: b.color }} />
              <span className="truncate">{b.label}</span>
            </button>
          ))}

          {flags.length > 0 && <div className="pt-2 text-[11px] font-medium text-slate-500">Flags</div>}

          {flags.map((f) => (
            <button
              key={f.id}
              onClick={() => onFlagLaneClick(f.id)}
              className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm ring-1 ${
                f.id === selectedFlagId
                  ? "bg-white ring-slate-300"
                  : "bg-transparent ring-transparent hover:bg-white/60"
              }`}
            >
              <span className="truncate text-xs text-slate-700">⚑ {f.code}</span>
              <span className="text-[10px] text-slate-500">{f.id === selectedFlagId ? "selected" : ""}</span>
            </button>
          ))}
        </div>

        {/* Right track */}
        <div
          ref={trackRef}
          className="relative rounded-lg bg-white ring-1 ring-slate-200"
          style={{ height: Math.max(totalRows * rowHeight + 12 + 28, 190) }}
        >
          {/* time ruler */}
          <div
            className="absolute left-0 right-0 top-0 h-7 select-none"
            onPointerDown={onRulerPointerDown}
            onPointerMove={onRulerPointerMove}
            onPointerUp={onRulerPointerUp}
            onPointerCancel={onRulerPointerUp}
          >
            <div className="absolute left-2 right-2 top-1/2 h-px -translate-y-1/2 bg-slate-200" />

            {ticks.map((t) => {
              const leftPct = (t / durationMs) * 100;
              const isMajor = t === 0 || t === durationMs;
              return (
                <div
                  key={t}
                  className="absolute top-0 bottom-0"
                  style={{ left: `calc(${leftPct}% )` }}
                >
                  <div
                    className={`absolute top-3 -translate-x-1/2 ${
                      isMajor ? "h-3 w-px bg-slate-500/60" : "h-2 w-px bg-slate-400/40"
                    }`}
                  />
                  <div className="absolute top-0 -translate-x-1/2 text-[10px] text-slate-500">
                    {formatTime(t)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* playhead */}
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-slate-900/60"
            style={{ left: `calc(${(timeMs / durationMs) * 100}% )` }}
          />

          {/* lanes start below ruler */}
          <div className="absolute left-0 right-0" style={{ top: 28 }}>
            {/* boat rows */}
            {boats.map((b, rowIdx) => {
              const top = topPad + rowIdx * rowHeight;
              const kfs = keyframesByBoatId[b.id] || [];
              const currentFrames = kfs.map((k) => msToFrame(k.tMs));

              return (
                <div key={b.id} className="absolute left-0 right-0" style={{ top, height: 34 }}>
                  <div className="absolute left-2 right-2 top-1/2 h-px -translate-y-1/2 bg-slate-200" />

                  <Slider
                    aria-label={`${b.label} keyframes`}
                    minValue={0}
                    maxValue={maxFrame}
                    step={1}
                    value={currentFrames}
                    onChange={(vals) => {
                      const incoming = Array.isArray(vals) ? vals : [vals];
                      if (incoming.length !== currentFrames.length) return;

                      const nextFrames = clampFramesBetweenNeighbors(currentFrames, incoming);
                      setBoatFrames(b.id, nextFrames);

                      const active = activeDragRef.current;
                      if (active?.boatId === b.id) {
                        const f = nextFrames[active.idx];
                        if (typeof f === "number") setTimeMs(frameToMs(f));
                      }
                    }}
                    className="absolute left-2 right-2 top-0 bottom-0"
                  >
                    <SliderTrack className="relative h-full w-full">
                      {() => (
                        <>
                          {currentFrames.map((_, i) => {
                            const isSel =
                              selected?.kind === "kf" &&
                              selected.boatId === b.id &&
                              selected.idx === i;

                            return (
                              <SliderThumb
                                key={`${b.id}:${i}`}
                                index={i}
                                className={[
                                  "absolute top-1/2 -translate-y-1/2",
                                  "h-4 w-4 rotate-45 rounded-sm ring-1",
                                  "focus:outline-none focus:ring-2 focus:ring-slate-400/60",
                                  isSel
                                    ? "bg-slate-900 ring-slate-900"
                                    : "bg-white ring-slate-400 hover:bg-slate-100",
                                ].join(" ")}
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  setSelectedBoatId(b.id);
                                  setSelectedFlagId(null);
                                  setSelected({ kind: "kf", boatId: b.id, idx: i });
                                  setIsPlaying(false);
                                  activeDragRef.current = { boatId: b.id, idx: i };
                                }}
                                onPointerUp={() => {
                                  const active = activeDragRef.current;
                                  if (active?.boatId === b.id && active.idx === i) {
                                    activeDragRef.current = null;
                                  }
                                }}
                              />
                            );
                          })}
                        </>
                      )}
                    </SliderTrack>
                  </Slider>
                </div>
              );
            })}

            {/* flag rows */}
            {flags.map((f, flagIdx) => {
              const rowIdx = boatRowCount + flagIdx;
              const top = topPad + rowIdx * rowHeight;
              const clips = flagClipsByFlagId[f.id] || [];

              return (
                <div
                  key={f.id}
                  className="absolute left-0 right-0"
                  style={{ top, height: 34 }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onFlagLaneClick(f.id);
                  }}
                >
                  <div className="absolute left-2 right-2 top-1/2 h-px -translate-y-1/2 bg-slate-200" />

                  {clips.map((c) => {
                    const leftPct = (c.startMs / durationMs) * 100;
                    const widthPct = ((c.endMs - c.startMs) / durationMs) * 100;
                    const isSel =
                      selected?.kind === "clip" &&
                      selected.flagId === f.id &&
                      selected.clipId === c.id;

                    return (
                      <div
                        key={c.id}
                        className="absolute top-1/2 -translate-y-1/2"
                        style={{ left: `calc(${leftPct}% )`, width: `calc(${widthPct}% )` }}
                      >
                        <button
                          onPointerDown={(e) => onClipPointerDown(e, f.id, c)}
                          onPointerMove={onClipPointerMove}
                          onPointerUp={onClipPointerUp}
                          className={`h-5 w-full rounded-md px-2 text-[11px] ring-1 ${
                            isSel
                              ? "bg-slate-900 text-white ring-slate-900"
                              : "bg-white text-slate-800 ring-slate-300 hover:bg-slate-50"
                          }`}
                          title={`${f.code}: ${formatTime(c.startMs)} → ${formatTime(c.endMs)} (${c.code})`}
                        >
                          {c.code}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* bottom labels */}
            <div className="absolute left-2 right-2" style={{ top: topPad + totalRows * rowHeight + 6 }}>
              <div className="flex justify-between text-xs text-slate-500">
                <span>{formatTime(0)}</span>
                <span>{formatTime(durationMs)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}