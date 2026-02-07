import React from "react";
import { formatTime, snapTime, xToMs } from "../lib/time";
import { clamp } from "../lib/math";
import { deleteKeyframeAt, moveKeyframe } from "../animation/keyframes";
import type {
  Boat,
  Flag,
  FlagCodeClip,
  FlagClipsByFlagId,
  KeyframesByBoatId,
} from "../types";

type SelectedKf = { kind: "kf"; boatId: string; tMs: number };
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

  // --- drag refs ---
  const dragKfRef = React.useRef<{ boatId: string; fromT: number; rect: DOMRect } | null>(null);

  const dragClipRef = React.useRef<{
    flagId: string;
    clipId: string;
    rect: DOMRect;
    lenMs: number;
    grabOffsetMs: number;
  } | null>(null);

  const jumpToX = (clientX: number) => {
    if (!trackRef.current) return;
    const r = trackRef.current.getBoundingClientRect();
    const x = clientX - r.left;
    const t = snapTime(xToMs(x, durationMs, r.width), fps);
    setIsPlaying(false);
    setTimeMs(t);
  };

  const onTrackPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    jumpToX(e.clientX);
  };

  // ─────────────────────────────
  // Boat keyframes
  // ─────────────────────────────
  const onKeyPointerDown = (e: React.PointerEvent<HTMLButtonElement>, boatId: string, tMs: number) => {
    e.stopPropagation();
    setSelectedBoatId(boatId);
    setSelectedFlagId(null);
    setSelected({ kind: "kf", boatId, tMs });
    setIsPlaying(false);

    if (!trackRef.current) return;
    const r = trackRef.current.getBoundingClientRect();
    dragKfRef.current = { boatId, fromT: tMs, rect: r };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const onKeyPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragKfRef.current) return;
    const { boatId, fromT, rect } = dragKfRef.current;

    const x = e.clientX - rect.left;
    const t = snapTime(xToMs(x, durationMs, rect.width), fps);

    setTimeMs(t);
    setKeyframesByBoatId((prev) => moveKeyframe(prev, boatId, fromT, t));

    dragKfRef.current.fromT = t;
    setSelected({ kind: "kf", boatId, tMs: t });
  };

  const onKeyPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    dragKfRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  // ─────────────────────────────
  // Flag clips (Option A)
  // ─────────────────────────────
  const onFlagLaneClick = (flagId: string) => {
    setSelectedBoatId(null);
    setSelectedFlagId(flagId);
    setSelected(null);
  };

  const onClipPointerDown = (e: React.PointerEvent<HTMLButtonElement>, flagId: string, clip: FlagCodeClip) => {
    e.stopPropagation();
    setSelectedBoatId(null);
    setSelectedFlagId(flagId);
    setSelected({ kind: "clip", flagId, clipId: clip.id });
    setIsPlaying(false);

    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const pointerT = snapTime(xToMs(x, durationMs, rect.width), fps);

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
    const pointerT = snapTime(xToMs(x, durationMs, rect.width), fps);

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

  // delete selection (kf or clip)
  React.useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key !== "Delete" && ev.key !== "Backspace") return;
      if (!selected) return;

      if (selected.kind === "kf") {
        setKeyframesByBoatId((prev) => deleteKeyframeAt(prev, selected.boatId, selected.tMs));
        setSelected(null);
        return;
      }

      if (selected.kind === "clip") {
        setFlagClipsByFlagId((prev) => {
          const list = prev[selected.flagId] ? [...prev[selected.flagId]] : [];
          const next = list.filter((c) => c.id !== selected.clipId);
          return { ...prev, [selected.flagId]: next };
        });
        setSelected(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, setKeyframesByBoatId, setFlagClipsByFlagId]);

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
                b.id === selectedBoatId ? "bg-white ring-slate-300" : "bg-transparent ring-transparent hover:bg-white/60"
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
                f.id === selectedFlagId ? "bg-white ring-slate-300" : "bg-transparent ring-transparent hover:bg-white/60"
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
          style={{ height: Math.max(totalRows * rowHeight + 12, 160) }}
          onPointerDown={onTrackPointerDown}
        >
          {/* playhead */}
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-slate-900/60"
            style={{ left: `calc(${(timeMs / durationMs) * 100}% )` }}
          />

          {/* boat rows */}
          {boats.map((b, rowIdx) => {
            const top = topPad + rowIdx * rowHeight;
            const kfs = keyframesByBoatId[b.id] || [];

            return (
              <div key={b.id} className="absolute left-0 right-0" style={{ top, height: 34 }}>
                <div className="absolute left-2 right-2 top-1/2 h-px -translate-y-1/2 bg-slate-200" />

                {kfs.map((k) => {
                  const leftPct = (k.tMs / durationMs) * 100;
                  const isSel = selected?.kind === "kf" && selected.boatId === b.id && selected.tMs === k.tMs;

                  return (
                    <div key={k.tMs} className="absolute top-1/2 -translate-y-1/2" style={{ left: `calc(${leftPct}% )` }}>
                      <button
                        onPointerDown={(e) => onKeyPointerDown(e, b.id, k.tMs)}
                        onPointerMove={onKeyPointerMove}
                        onPointerUp={onKeyPointerUp}
                        className={`h-4 w-4 rotate-45 rounded-sm ring-1 ${
                          isSel ? "bg-slate-900 ring-slate-900" : "bg-white ring-slate-400 hover:bg-slate-100"
                        }`}
                        title={`${b.label} @ ${formatTime(k.tMs)}`}
                      />
                    </div>
                  );
                })}
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

                  const isSel = selected?.kind === "clip" && selected.flagId === f.id && selected.clipId === c.id;

                  return (
                    <div
                      key={c.id}
                      className="absolute top-1/2 -translate-y-1/2"
                      style={{ left: `calc(${leftPct}% )`, width: `calc(${widthPct}% )`, minWidth: 14 }}
                    >
                      <button
                        onPointerDown={(e) => onClipPointerDown(e, f.id, c)}
                        onPointerMove={onClipPointerMove}
                        onPointerUp={onClipPointerUp}
                        className={`h-5 w-full rounded-md px-2 text-[11px] ring-1 ${
                          isSel ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-800 ring-slate-300 hover:bg-slate-50"
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

          <div className="absolute bottom-2 left-2 right-2 flex justify-between text-xs text-slate-500">
            <span>{formatTime(0)}</span>
            <span>{formatTime(durationMs)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}