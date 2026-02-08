import { useEffect, useMemo, useRef, useState } from "react";
import { clamp } from "./lib/math";
import { uid } from "./lib/ids";
import { formatTime, snapTime } from "./lib/time";
import { drawBoat } from "./canvas/boat";
import { drawGrid } from "./canvas/grid";
import { hitTestBoat } from "./canvas/hitTest";
import { drawMark, hitTestMark } from "./canvas/marks";
import { drawWind } from "./canvas/wind";
import { drawStartLine, hitTestStartHandle } from "./canvas/startLine";
import { drawFlag, hitTestFlag, resolveActiveFlagCode } from "./canvas/flags";
import { interpolateBoatsAtTime } from "./animation/interpolate";
import { upsertKeyframe } from "./animation/keyframes";
import TimelineDopeSheet from "./components/TimelineDopeSheet";
import CoursePanel from "./components/CoursePanel";
import FlagsPanel from "./components/FlagsPanel";
import type {
  Boat,
  Flag,
  FlagClipsByFlagId,
  KeyframesByBoatId,
  Mark,
  StartLine,
  ToolMode,
  Wind,
} from "./types";
import { DEFAULT_MARKS, DEFAULT_START_LINE } from "./canvas/defaults";

const DEFAULT_DURATION_MS = 12000;
const DEFAULT_FPS = 60;

type ProjectFile = {
  version: number;
  durationMs: number;
  fps: number;
  boats: Boat[];
  keyframesByBoatId: KeyframesByBoatId;
  marks: Mark[];
  wind: Wind;
  startLine: StartLine;
  flags: Flag[];
  flagClipsByFlagId: FlagClipsByFlagId;
};

export default function SailingAnimationBuilder() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [durationMs, setDurationMs] = useState<number>(DEFAULT_DURATION_MS);
  const [fps, setFps] = useState<number>(DEFAULT_FPS);
  const [timeMs, setTimeMs] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const [autoKey, setAutoKey] = useState<boolean>(true);

  // If your flags.ts dispatches "flagassetloaded" in img.onload, this will refresh the canvas.
  // We also include a RAF fallback tick so flags appear even if that event is missing.
  const [assetTick, setAssetTick] = useState<number>(0);

  useEffect(() => {
    const onAsset = () => setAssetTick((t) => t + 1);
    window.addEventListener("flagassetloaded", onAsset);

    return () => {
      window.removeEventListener("flagassetloaded", onAsset);
    };
  }, []);

  const [boats, setBoats] = useState<Boat[]>(() => [
    { id: uid(), label: "Blue", color: "#3b82f6", x: 520, y: 170, headingDeg: 20 },
    { id: uid(), label: "Yellow", color: "#f59e0b", x: 500, y: 235, headingDeg: 20 },
  ]);

  const [keyframesByBoatId, setKeyframesByBoatId] = useState<KeyframesByBoatId>(() => ({}));

  const [marks, setMarks] = useState<Mark[]>(() => DEFAULT_MARKS);

  const [wind, setWind] = useState<Wind>(() => ({ fromDeg: 0, speedKt: 15 }));

  const [startLine, setStartLine] = useState<StartLine>(() => (DEFAULT_START_LINE));

  // Flags (Option A)
  const [flags, setFlags] = useState<Flag[]>([]);
  const [flagClipsByFlagId, setFlagClipsByFlagId] = useState<FlagClipsByFlagId>(() => ({}));
  const [selectedFlagId, setSelectedFlagId] = useState<string | null>(null);

  useEffect(() => {
  // redraw burst any time flags/clips change (covers async decode even if no event fires)
    let raf = 0;
    let frames = 0;

    const pump = () => {
      frames++;
      setAssetTick((t) => t + 1);
      if (frames < 12) raf = requestAnimationFrame(pump);
    };

    raf = requestAnimationFrame(pump);
    return () => cancelAnimationFrame(raf);
  }, [flags.length, flagClipsByFlagId]);


  // If you want flags to show immediately even with clips-only visibility:
  // Option A already makes "no clips => show flag.code", so no seed required.
  // Leaving this effect OUT avoids confusion. If you want a seed clip, do it when adding a flag.

  const [selectedBoatId, setSelectedBoatId] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolMode>("select");
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);

  // refs for pointer handlers
  const boatsRef = useRef<Boat[]>(boats);
  const toolRef = useRef<ToolMode>(tool);
  const snapRef = useRef<boolean>(snapToGrid);
  const timeRef = useRef<number>(timeMs);
  const fpsRef = useRef<number>(fps);
  const marksRef = useRef<Mark[]>(marks);
  const startLineRef = useRef<StartLine>(startLine);
  const flagsRef = useRef<Flag[]>(flags);
  const flagClipsRef = useRef<FlagClipsByFlagId>(flagClipsByFlagId);

  useEffect(() => void (boatsRef.current = boats), [boats]);
  useEffect(() => void (toolRef.current = tool), [tool]);
  useEffect(() => void (snapRef.current = snapToGrid), [snapToGrid]);
  useEffect(() => void (timeRef.current = timeMs), [timeMs]);
  useEffect(() => void (fpsRef.current = fps), [fps]);
  useEffect(() => void (marksRef.current = marks), [marks]);
  useEffect(() => void (startLineRef.current = startLine), [startLine]);
  useEffect(() => void (flagsRef.current = flags), [flags]);
  useEffect(() => void (flagClipsRef.current = flagClipsByFlagId), [flagClipsByFlagId]);

  const [exportText, setExportText] = useState<string>("");

  const selectedBoat = useMemo(
    () => boats.find((b) => b.id === selectedBoatId) || null,
    [boats, selectedBoatId],
  );

  // animation loop
  useEffect(() => {
    if (!isPlaying) return;

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = now - last;
      last = now;

      setTimeMs((t) => {
        const next = t + dt;
        if (next >= durationMs) {
          setIsPlaying(false);
          return durationMs;
        }
        return next;
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, durationMs]);

  // draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const w = Math.floor(rect.width * dpr);
    const h = Math.floor(rect.height * dpr);

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawGrid(ctx, rect.width, rect.height);

    // behind boats
    drawWind(ctx, wind, { x: 90, y: 70 });
    drawStartLine(ctx, startLine);
    for (const m of marks) drawMark(ctx, m);

    const displayed = interpolateBoatsAtTime(boats, keyframesByBoatId, timeMs);

    // tracks
    ctx.save();
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    for (const b of boats) {
      const kfs = keyframesByBoatId[b.id] || [];
      if (kfs.length < 2) continue;
      ctx.beginPath();
      kfs.forEach((k, i) =>
        i === 0 ? ctx.moveTo(k.state.x, k.state.y) : ctx.lineTo(k.state.x, k.state.y),
      );
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.stroke();
    }
    ctx.restore();

    // boats
    for (const b of displayed) {
      drawBoat(ctx, b);

      if (b.id === selectedBoatId) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x, b.y, 38, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 6]);
        ctx.stroke();
        ctx.restore();
      }

      if (startLine.startBoatId && b.id === startLine.startBoatId) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x, b.y, 44, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(16,185,129,0.35)";
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.restore();
      }
    }

    // flags (overlay) — Option A: resolve code by time per-flag lane
    for (const f of flags) {
      const code = resolveActiveFlagCode(f, flagClipsByFlagId[f.id], timeMs);
      if (!code) continue;
      drawFlag(ctx, f, code, selectedFlagId === f.id);
    }

    // time indicator
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${formatTime(timeMs)} / ${formatTime(durationMs)}`, 12, 18);
    ctx.restore();
  }, [
    boats,
    keyframesByBoatId,
    timeMs,
    durationMs,
    selectedBoatId,
    marks,
    wind,
    startLine,
    flags,
    flagClipsByFlagId,
    selectedFlagId,
    assetTick,
  ]);

  // pointer interactions (flags + start line + marks + boats)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    type DragMode =
      | { kind: "flag"; flagId: string; dragOffset: { x: number; y: number } }
      | { kind: "start"; handle: "committee" | "pin" }
      | { kind: "mark"; markId: string; dragOffset: { x: number; y: number } }
      | { kind: "boat"; boatId: string; mode: "drag" | "rotate"; dragOffset: { x: number; y: number } }
      | null;

    let active: DragMode = null;

    const getPoint = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onDown = (e: PointerEvent) => {
      const p = getPoint(e);

      // start line handles
      const h = hitTestStartHandle(p.x, p.y, startLineRef.current);
      if (h) {
        active = { kind: "start", handle: h };
        setSelectedBoatId(null);
        setSelectedFlagId(null);
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {}
        e.preventDefault();
        return;
      }

      // flags
      const flagsNow = flagsRef.current;
      for (let i = flagsNow.length - 1; i >= 0; i--) {
        const f = flagsNow[i];
        const codeNow = resolveActiveFlagCode(f, flagClipsRef.current[f.id], timeRef.current);
        if (!codeNow) continue;

        if (hitTestFlag(p.x, p.y, f)) {
          active = { kind: "flag", flagId: f.id, dragOffset: { x: p.x - f.x, y: p.y - f.y } };
          setSelectedFlagId(f.id);
          setSelectedBoatId(null);
          try {
            canvas.setPointerCapture(e.pointerId);
          } catch {}
          e.preventDefault();
          return;
        }
      }

      // marks
      const marksNow = marksRef.current;
      for (let i = marksNow.length - 1; i >= 0; i--) {
        const m = marksNow[i];
        if (hitTestMark(p.x, p.y, m)) {
          active = { kind: "mark", markId: m.id, dragOffset: { x: p.x - m.x, y: p.y - m.y } };
          setSelectedBoatId(null);
          setSelectedFlagId(null);
          try {
            canvas.setPointerCapture(e.pointerId);
          } catch {}
          e.preventDefault();
          return;
        }
      }

      // boats
      const boatsNow = boatsRef.current;
      let hit: Boat | null = null;
      for (let i = boatsNow.length - 1; i >= 0; i--) {
        const b = boatsNow[i];
        if (hitTestBoat(p.x, p.y, b)) {
          hit = b;
          break;
        }
      }

      if (!hit) {
        active = null;
        setSelectedBoatId(null);
        setSelectedFlagId(null);
        return;
      }

      setSelectedBoatId(hit.id);
      setSelectedFlagId(null);

      const toolNow = toolRef.current;
      if (toolNow === "rotate") {
        active = { kind: "boat", boatId: hit.id, mode: "rotate", dragOffset: { x: 0, y: 0 } };
      } else {
        active = { kind: "boat", boatId: hit.id, mode: "drag", dragOffset: { x: p.x - hit.x, y: p.y - hit.y } };
      }

      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {}
      e.preventDefault();
    };

    const onMove = (e: PointerEvent) => {
      if (!active) return;
      const p = getPoint(e);

      if (active.kind === "start") {
        const handle = active.handle;
        setStartLine((s) => ({ ...s, [handle]: { x: p.x, y: p.y } }));
        e.preventDefault();
        return;
      }

      if (active.kind === "flag") {
        const { flagId, dragOffset } = active;
        const snapNow = snapRef.current;

        setFlags((prev) =>
          prev.map((f) => {
            if (f.id !== flagId) return f;
            let nx = p.x - dragOffset.x;
            let ny = p.y - dragOffset.y;
            if (snapNow) {
              const s = 5;
              nx = Math.round(nx / s) * s;
              ny = Math.round(ny / s) * s;
            }
            return { ...f, x: nx, y: ny };
          }),
        );
        e.preventDefault();
        return;
      }

      if (active.kind === "mark") {
        const markId = active.markId;
        const offset = active.dragOffset;
        const snapNow = snapRef.current;

        setMarks((prev) =>
          prev.map((m) => {
            if (m.id !== markId) return m;
            let nx = p.x - offset.x;
            let ny = p.y - offset.y;
            if (snapNow) {
              const s = 5;
              nx = Math.round(nx / s) * s;
              ny = Math.round(ny / s) * s;
            }
            return { ...m, x: nx, y: ny };
          }),
        );

        e.preventDefault();
        return;
      }

      if (active.kind === "boat") {
        const boatId = active.boatId;
        const mode = active.mode;
        const offset = active.dragOffset;
        const snapNow = snapRef.current;

        if (mode === "drag") {
          setBoats((prev) =>
            prev.map((b) => {
              if (b.id !== boatId) return b;
              let nx = p.x - offset.x;
              let ny = p.y - offset.y;
              if (snapNow) {
                const s = 5;
                nx = Math.round(nx / s) * s;
                ny = Math.round(ny / s) * s;
              }
              return { ...b, x: nx, y: ny };
            }),
          );
        }

        if (mode === "rotate") {
          setBoats((prev) =>
            prev.map((b) => {
              if (b.id !== boatId) return b;
              const dx = p.x - b.x;
              const dy = p.y - b.y;
              const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
              const heading = (ang + 90 + 360) % 360;
              return { ...b, headingDeg: heading };
            }),
          );
        }

        if (autoKey) {
          const nowT = snapTime(timeRef.current, fpsRef.current);
          const b = boatsRef.current.find((x) => x.id === boatId);
          if (b) {
            setKeyframesByBoatId((prev) =>
              upsertKeyframe(prev, boatId, nowT, { x: b.x, y: b.y, headingDeg: b.headingDeg }),
            );
          }
        }

        e.preventDefault();
        return;
      }
    };

    const onUp = (e: PointerEvent) => {
      active = null;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, [autoKey]);

  // import/export
  const exportProject = () => {
    const project: ProjectFile = {
      version: 3,
      durationMs,
      fps,
      boats,
      keyframesByBoatId,
      marks,
      wind,
      startLine,
      flags,
      flagClipsByFlagId,
    };
    setExportText(JSON.stringify(project, null, 2));
  };

  const importProject = () => {
    try {
      const parsed = JSON.parse(exportText) as Partial<ProjectFile> & { flagVisibilityById?: unknown };
      if (!parsed || typeof parsed !== "object") return;

      setDurationMs(typeof parsed.durationMs === "number" ? parsed.durationMs : DEFAULT_DURATION_MS);
      setFps(typeof parsed.fps === "number" ? parsed.fps : DEFAULT_FPS);
      setBoats(Array.isArray(parsed.boats) ? (parsed.boats as Boat[]) : []);
      setKeyframesByBoatId(
        parsed.keyframesByBoatId && typeof parsed.keyframesByBoatId === "object"
          ? (parsed.keyframesByBoatId as KeyframesByBoatId)
          : {},
      );
      setMarks(Array.isArray(parsed.marks) ? (parsed.marks as Mark[]) : []);
      setWind(parsed.wind && typeof parsed.wind === "object" ? (parsed.wind as Wind) : { fromDeg: 210, speedKt: 18 });
      setStartLine(
        parsed.startLine && typeof parsed.startLine === "object"
          ? (parsed.startLine as StartLine)
          : { committee: { x: 380, y: 120 }, pin: { x: 660, y: 150 }, startBoatId: null },
      );
      setFlags(Array.isArray(parsed.flags) ? (parsed.flags as Flag[]) : []);

      const clips =
        (parsed.flagClipsByFlagId && typeof parsed.flagClipsByFlagId === "object"
          ? (parsed.flagClipsByFlagId as FlagClipsByFlagId)
          : null) ??
        // legacy fallback if you used a different name
        (parsed.flagVisibilityById && typeof parsed.flagVisibilityById === "object"
          ? (parsed.flagVisibilityById as FlagClipsByFlagId)
          : {});

      setFlagClipsByFlagId(clips);

      setTimeMs(0);
      setIsPlaying(false);
      setSelectedBoatId(null);
      setSelectedFlagId(null);
    } catch {
      // ignore
    }
  };

  const getCanvasCenter = () => {
    const el = wrapRef.current;
    if (!el) return { x: 500, y: 250 };
    const r = el.getBoundingClientRect();
    return { x: r.width / 2, y: r.height / 2 };
  };

  const addBoat = () => {
    const id = uid();
    const center = getCanvasCenter();
    setBoats((prev) => [
      ...prev,
      {
        id,
        label: `Boat ${prev.length + 1}`,
        color: "#22c55e",
        x: center.x + 30 * (prev.length % 3),
        y: center.y + 30 * (prev.length % 3),
        headingDeg: 0,
      },
    ]);
    setSelectedBoatId(id);
  };

  const deleteSelectedBoat = () => {
    if (!selectedBoatId) return;
    setBoats((prev) => prev.filter((b) => b.id !== selectedBoatId));
    setKeyframesByBoatId((prev) => {
      const next = { ...prev };
      delete next[selectedBoatId];
      return next;
    });
    setStartLine((s) => ({ ...s, startBoatId: s.startBoatId === selectedBoatId ? null : s.startBoatId }));
    setSelectedBoatId(null);
  };

  const togglePlay = () => setIsPlaying((p) => !p);
  const jumpToStart = () => setTimeMs(0);
  const jumpToEnd = () => setTimeMs(durationMs);

  const updateSelectedBoat = (patch: Partial<Boat>) => {
    if (!selectedBoatId) return;
    setBoats((prev) => prev.map((b) => (b.id === selectedBoatId ? { ...b, ...patch } : b)));
  };

  const displayedForInspector = useMemo(() => {
    const displayed = interpolateBoatsAtTime(boats, keyframesByBoatId, timeMs);
    return selectedBoatId ? displayed.find((b) => b.id === selectedBoatId) || null : null;
  }, [boats, keyframesByBoatId, timeMs, selectedBoatId]);

  const boatsOptions = useMemo(() => boats.map((b) => ({ id: b.id, label: b.label })), [boats]);

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-6xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Sailing Whiteboard</h1>
            <p className="text-sm text-slate-600">Animate your sailing - Show people what happened out there.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded-2xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
              onClick={addBoat}
            >
              + Boat
            </button>
            <button
              className="rounded-2xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
              onClick={deleteSelectedBoat}
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
              <input type="checkbox" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} />
              Snap
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
          <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
            <div ref={wrapRef} className="relative aspect-16/10 w-full overflow-hidden rounded-xl ring-1 ring-slate-200">
              <canvas ref={canvasRef} className="h-full w-full touch-none" />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="flex items-center gap-2">
                <button className="rounded-xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 hover:bg-slate-50" onClick={jumpToStart}>
                  ⏮
                </button>
                <button
                  className={`rounded-xl px-3 py-2 text-sm shadow-sm ring-1 ${
                    isPlaying ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-900 ring-slate-200 hover:bg-slate-50"
                  }`}
                  onClick={togglePlay}
                >
                  {isPlaying ? "Pause" : "Play"}
                </button>
                <button className="rounded-xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 hover:bg-slate-50" onClick={jumpToEnd}>
                  ⏭
                </button>
              </div>

              <div className="flex items-center gap-3 text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Duration</span>
                  <input
                    className="w-24 rounded-lg bg-white px-2 py-1 ring-1 ring-slate-200"
                    type="number"
                    value={Math.round(durationMs / 1000)}
                    min={1}
                    max={120}
                    onChange={(e) => {
                      const s = Number(e.target.value || 12);
                      const ms = clamp(s * 1000, 1000, 120000);
                      setDurationMs(ms);
                      setTimeMs((t) => clamp(t, 0, ms));
                    }}
                  />
                  <span className="text-slate-500">s</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-500">FPS</span>
                  <input
                    className="w-20 rounded-lg bg-white px-2 py-1 ring-1 ring-slate-200"
                    type="number"
                    value={fps}
                    min={12}
                    max={120}
                    onChange={(e) => setFps(clamp(Number(e.target.value || 60), 12, 120))}
                  />
                </div>
              </div>
            </div>

            <div className="mt-3">
              <TimelineDopeSheet
                boats={boats}
                keyframesByBoatId={keyframesByBoatId}
                // ✅ Option A additions (implement in TimelineDopeSheet)
                flags={flags}
                flagClipsByFlagId={flagClipsByFlagId}
                setFlagClipsByFlagId={setFlagClipsByFlagId}
                selectedFlagId={selectedFlagId}
                setSelectedFlagId={setSelectedFlagId}
                //
                timeMs={timeMs}
                durationMs={durationMs}
                fps={fps}
                selectedBoatId={selectedBoatId}
                setSelectedBoatId={setSelectedBoatId}
                setTimeMs={(t: number) => {
                  setIsPlaying(false);
                  setTimeMs(t);
                }}
                setIsPlaying={setIsPlaying}
                setKeyframesByBoatId={setKeyframesByBoatId}
                autoKey={autoKey}
                setAutoKey={setAutoKey}
              />

              <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                <span>{formatTime(timeMs)}</span>
                <span>{formatTime(durationMs)}</span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-end gap-2">
              <button className="rounded-xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 hover:bg-slate-50" onClick={exportProject}>
                Export
              </button>
              <button className="rounded-xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 hover:bg-slate-50" onClick={importProject}>
                Import
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <CoursePanel
              marks={marks}
              setMarks={setMarks}
              wind={wind}
              setWind={setWind}
              startLine={startLine}
              setStartLine={setStartLine}
              boatsOptions={boatsOptions}
            />

            <FlagsPanel
              flags={flags}
              setFlags={setFlags}
              flagClipsByFlagId={flagClipsByFlagId}
              setFlagClipsByFlagId={setFlagClipsByFlagId}
              selectedFlagId={selectedFlagId}
              setSelectedFlagId={setSelectedFlagId}
              timeMs={timeMs}
              durationMs={durationMs}
            />

            <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">Inspector</h2>
              <p className="mt-1 text-xs text-slate-600">Select a boat and adjust properties.</p>

              <div className="mt-3 space-y-3">
                <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <div className="text-xs font-medium text-slate-700">Selected Boat</div>

                  {!selectedBoatId || !selectedBoat ? (
                    <div className="mt-2 text-sm text-slate-600">No boat selected.</div>
                  ) : (
                    <div className="mt-2 space-y-3">
                      <label className="block">
                        <div className="text-xs text-slate-600">Label</div>
                        <input
                          className="mt-1 w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-200"
                          value={selectedBoat.label}
                          onChange={(e) => updateSelectedBoat({ label: e.target.value })}
                        />
                      </label>

                      <label className="block">
                        <div className="text-xs text-slate-600">Color</div>
                        <input
                          className="mt-1 h-10 w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-200"
                          type="color"
                          value={selectedBoat.color}
                          onChange={(e) => updateSelectedBoat({ color: e.target.value })}
                        />
                      </label>

                      <div className="grid grid-cols-2 gap-2">
                        <label className="block">
                          <div className="text-xs text-slate-600">X</div>
                          <input
                            className="mt-1 w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-200"
                            type="number"
                            value={Math.round(selectedBoat.x)}
                            onChange={(e) => updateSelectedBoat({ x: Number(e.target.value) })}
                          />
                        </label>
                        <label className="block">
                          <div className="text-xs text-slate-600">Y</div>
                          <input
                            className="mt-1 w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-200"
                            type="number"
                            value={Math.round(selectedBoat.y)}
                            onChange={(e) => updateSelectedBoat({ y: Number(e.target.value) })}
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
                          onChange={(e) => updateSelectedBoat({ headingDeg: Number(e.target.value) })}
                        />
                        <div className="mt-1 text-xs text-slate-600">{Math.round(selectedBoat.headingDeg) % 360}°</div>
                      </label>

                      <div className="rounded-lg bg-white p-2 text-xs text-slate-700 ring-1 ring-slate-200">
                        <div className="font-medium text-slate-800">Displayed at current time</div>
                        {displayedForInspector ? (
                          <div className="mt-1 grid grid-cols-2 gap-2">
                            <div>x: {displayedForInspector.x.toFixed(1)}</div>
                            <div>y: {displayedForInspector.y.toFixed(1)}</div>
                            <div>hdg: {displayedForInspector.headingDeg.toFixed(1)}°</div>
                            <div>kfs: {(keyframesByBoatId[selectedBoatId] || []).length}</div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <div className="text-xs font-medium text-slate-700">Project JSON</div>
                  <textarea
                    className="mt-2 h-52 w-full resize-none rounded-lg bg-white p-2 text-xs ring-1 ring-slate-200"
                    value={exportText}
                    onChange={(e) => setExportText(e.target.value)}
                    placeholder="Click Export to generate JSON, or paste JSON here then click Import."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs text-slate-500">
          Tip: Option A — a flag shows its default code when it has no clips, otherwise it shows the active clip’s code.
        </div>
      </div>
    </div>
  );
}