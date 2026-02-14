// src/SailingAnimationBuilder.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { clamp } from "./lib/math";
import { uid } from "./lib/ids";
import { formatTime, snapTime } from "./lib/time";
import { drawBoat } from "./canvas/boat";
import { drawGrid } from "./canvas/grid";
import { drawMark } from "./canvas/marks";
import { drawWind } from "./canvas/wind";
import { drawStartLine } from "./canvas/startLine";
import { drawFlag, resolveActiveFlagCode } from "./canvas/flags";
import { sampleStepsPath } from "./animation/stepsPath";
import StepsDopeSheet from "./components/StepsDopeSheet";
import CoursePanel from "./components/CoursePanel";
import FlagsPanel from "./components/FlagsPanel";
import type {
  Boat,
  Flag,
  FlagClipsByFlagId,
  KeyframesByBoatId,
  Mark,
  SegmentsByBoatId,
  StartLine,
  Step,
  StepsByBoatId,
  ToolMode,
  Wind,
} from "./types";
import {
  DEFAULT_BOATS,
  DEFAULT_MARKS,
  DEFAULT_START_LINE,
} from "./canvas/defaults";
import { interpolateBoatsAtTimeFromSteps } from "./animation/stepsInterpolate";

// NEW: extracted hooks/types
import { useProjectIO } from "./builder/useProjectIO";
import { useCanvasInteractions } from "./builder/useCanvasInteractions";
import { DEFAULT_DURATION_MS, DEFAULT_FPS } from "./builder/projectTypes";

function ensureStartSteps(boats: Boat[], prev: StepsByBoatId): StepsByBoatId {
  let next: StepsByBoatId = prev;
  for (const b of boats) {
    const list = next[b.id] ?? [];
    const hasZero = list.some((s) => s.tMs === 0);
    if (!hasZero) {
      const newStep: Step = {
        id: uid(),
        tMs: 0,
        x: b.x,
        y: b.y,
        headingMode: "auto",
      };
      next = {
        ...next,
        [b.id]: [...list, newStep].sort((a, c) => a.tMs - c.tMs),
      };
    }
  }
  return next;
}

function sortSteps(list: Step[]) {
  return list.slice().sort((a, b) => a.tMs - b.tMs);
}

function frameStepMs(fps: number) {
  return Math.max(1, Math.round(1000 / fps));
}

function findClosestStepIndex(steps: Step[], tMs: number) {
  if (steps.length === 0) return -1;
  let bestI = 0;
  let bestD = Infinity;
  for (let i = 0; i < steps.length; i++) {
    const d = Math.abs(steps[i].tMs - tMs);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  return bestI;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function drawStepBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
) {
  ctx.save();
  ctx.font = "11px ui-sans-serif, system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const padX = 6;
  const h = 16;
  const w = Math.max(16, ctx.measureText(text).width + padX * 2);

  roundRectPath(ctx, x - w / 2, y - h / 2, w, h, 7);
  ctx.fillStyle = "rgba(15, 23, 42, 0.65)";
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}

export default function SailingAnimationBuilder() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // core timeline state
  const [durationMs, setDurationMs] = useState<number>(DEFAULT_DURATION_MS);
  const [fps, setFps] = useState<number>(DEFAULT_FPS);
  const [timeMs, setTimeMs] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);

  // (kept) other state
  const [autoKey] = useState<boolean>(true);
  const [segmentsByBoatId] = useState<SegmentsByBoatId>(() => ({}));

  // redraw tick for async-loaded flag SVG assets
  const [assetTick, setAssetTick] = useState<number>(0);
  useEffect(() => {
    const h = () => setAssetTick((t) => t + 1);
    window.addEventListener("flagassetloaded", h);
    return () => window.removeEventListener("flagassetloaded", h);
  }, []);

  const [boats, setBoats] = useState<Boat[]>(() => DEFAULT_BOATS);

  // keyframes (legacy)
  const [keyframesByBoatId, setKeyframesByBoatId] = useState<KeyframesByBoatId>(
    () => ({}),
  );

  // steps (current)
  const [stepsByBoatId, setStepsByBoatId] = useState<StepsByBoatId>(() => ({}));

  useEffect(() => {
    setStepsByBoatId((prev) => ensureStartSteps(boats, prev));
  }, [boats]);

  // course
  const [marks, setMarks] = useState<Mark[]>(() => DEFAULT_MARKS);
  const [wind, setWind] = useState<Wind>(() => ({ fromDeg: 0, speedKt: 15 }));
  const [startLine, setStartLine] = useState<StartLine>(
    () => DEFAULT_START_LINE,
  );

  // flags
  const [flags, setFlags] = useState<Flag[]>([]);
  const [flagClipsByFlagId, setFlagClipsByFlagId] = useState<FlagClipsByFlagId>(
    () => ({}),
  );
  const [selectedFlagId, setSelectedFlagId] = useState<string | null>(null);

  // selection + tool
  const [selectedBoatId, setSelectedBoatId] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolMode>("select");
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);

  const [exportText, setExportText] = useState<string>("");

  const selectedBoat = useMemo(
    () => boats.find((b) => b.id === selectedBoatId) || null,
    [boats, selectedBoatId],
  );

  const displayedBoats = useMemo(
    () =>
      interpolateBoatsAtTimeFromSteps(
        boats,
        stepsByBoatId,
        segmentsByBoatId,
        timeMs,
      ),
    [boats, stepsByBoatId, segmentsByBoatId, timeMs],
  );

  // --- Import/Export (extracted, identical behavior)
  const { exportProject, importProject } = useProjectIO({
    durationMs,
    fps,
    boats,
    keyframesByBoatId,
    marks,
    wind,
    startLine,
    flags,
    flagClipsByFlagId,

    setDurationMs,
    setFps,
    setBoats,
    setKeyframesByBoatId,
    setMarks,
    setWind,
    setStartLine,
    setFlags,
    setFlagClipsByFlagId,

    setTimeMs,
    setIsPlaying,
    setSelectedBoatId,
    setSelectedFlagId,

    exportText,
    setExportText,
  });

  // playback loop uses a ref (so rate changes don’t restart the effect)
  const playbackRateRef = useRef<number>(playbackRate);
  useEffect(
    () => void (playbackRateRef.current = playbackRate),
    [playbackRate],
  );

  // animation loop (speed affects playback only)
  useEffect(() => {
    if (!isPlaying) return;

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = now - last;
      last = now;

      const rate = playbackRateRef.current || 1;

      setTimeMs((t) => {
        const next = t + dt * rate;
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

  // pointer interactions (extracted, identical behavior)
  useCanvasInteractions({
    canvasRef,
    autoKey,
    tool,
    snapToGrid,
    timeMs,
    fps,
    marks,
    startLine,
    flags,
    flagClipsByFlagId,
    displayedBoats,
    setStepsByBoatId,
    setMarks,
    setStartLine,
    setFlags,
    setSelectedBoatId,
    setSelectedFlagId,
  });

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

    // tracks (under ghosts + boats)
    ctx.save();
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    for (const b of boats) {
      const steps = stepsByBoatId[b.id] || [];
      if (steps.length < 2) continue;

      const pts = sampleStepsPath(steps, segmentsByBoatId[b.id] || [], 24);
      if (pts.length < 2) continue;

      ctx.beginPath();
      pts.forEach((pt, i) =>
        i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y),
      );
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.stroke();
    }
    ctx.restore();

    // --- ghost boats at each step time + step labels ---
    const snappedNow = snapTime(timeMs, fps);
    const frame = frameStepMs(fps);

    for (const b of boats) {
      const laneSteps = sortSteps(stepsByBoatId[b.id] || []);
      if (laneSteps.length === 0) continue;

      const closestI = findClosestStepIndex(laneSteps, snappedNow);

      for (let i = 0; i < laneSteps.length; i++) {
        const s = laneSteps[i];

        const poseAtStep = interpolateBoatsAtTimeFromSteps(
          boats,
          stepsByBoatId,
          segmentsByBoatId,
          s.tMs,
        ).find((x) => x.id === b.id);

        if (!poseAtStep) continue;

        const isClosest =
          i === closestI &&
          Math.abs((laneSteps[closestI]?.tMs ?? 0) - snappedNow) <= frame;

        ctx.save();

        // boat ghost alpha
        ctx.globalAlpha = isClosest ? 0.45 : 0.18;

        // IMPORTANT: keep label empty so ghosts don't clutter (drawBoat may render label)
        drawBoat(ctx, {
          ...poseAtStep,
          label: "",
          color: isClosest ? b.color : "#94a3b8",
        });

        // step badge slightly clearer than boat
        ctx.globalAlpha = isClosest ? 0.75 : 0.45;
        drawStepBadge(ctx, poseAtStep.x, poseAtStep.y - 44, String(i + 1));

        ctx.restore();
      }
    }

    // current boats (at playhead)
    for (const b of displayedBoats) {
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

      // start boat marker
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

    // flags overlay
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
    ctx.fillText(
      `t = ${formatTime(timeMs)} / ${formatTime(durationMs)}`,
      12,
      18,
    );
    ctx.restore();
  }, [
    boats,
    stepsByBoatId,
    segmentsByBoatId,
    timeMs,
    durationMs,
    fps,
    selectedBoatId,
    marks,
    wind,
    startLine,
    flags,
    flagClipsByFlagId,
    selectedFlagId,
    assetTick,
    displayedBoats,
  ]);

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

    setStepsByBoatId((prev) => {
      const next = { ...prev };
      delete next[selectedBoatId];
      return next;
    });

    setStartLine((s) => ({
      ...s,
      startBoatId: s.startBoatId === selectedBoatId ? null : s.startBoatId,
    }));

    setSelectedBoatId(null);
  };

  const updateSelectedBoat = (patch: Partial<Boat>) => {
    if (!selectedBoatId) return;
    setBoats((prev) =>
      prev.map((b) => (b.id === selectedBoatId ? { ...b, ...patch } : b)),
    );
  };

  const displayedForInspector = useMemo(() => {
    return selectedBoatId
      ? displayedBoats.find((b) => b.id === selectedBoatId) || null
      : null;
  }, [displayedBoats, selectedBoatId]);

  const boatsOptions = useMemo(
    () => boats.map((b) => ({ id: b.id, label: b.label })),
    [boats],
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="mx-auto max-w-6xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Sailing Whiteboard
            </h1>
            <p className="text-sm text-slate-600">
              Show what happens out on the course.
            </p>
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
              <input
                type="checkbox"
                checked={snapToGrid}
                onChange={(e) => setSnapToGrid(e.target.checked)}
              />
              Snap
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
          <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
            <div
              ref={wrapRef}
              className="relative aspect-[16/10] w-full overflow-hidden rounded-xl ring-1 ring-slate-200 touch-none"
            >
              <canvas ref={canvasRef} className="h-full w-full touch-none" />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-end gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="flex items-center gap-2 text-sm text-slate-700">
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

              <div className="flex items-center gap-2 text-sm text-slate-700">
                <span className="text-slate-500">FPS</span>
                <input
                  className="w-20 rounded-lg bg-white px-2 py-1 ring-1 ring-slate-200"
                  type="number"
                  value={fps}
                  min={12}
                  max={120}
                  onChange={(e) =>
                    setFps(clamp(Number(e.target.value || 60), 12, 120))
                  }
                />
              </div>
            </div>

            <div className="mt-3">
              <StepsDopeSheet
                boats={boats}
                stepsByBoatId={stepsByBoatId}
                setStepsByBoatId={setStepsByBoatId}
                displayedBoats={displayedBoats}
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
                isPlaying={isPlaying}
                onPlaybackRateChange={(r) => setPlaybackRate(r)}
                flags={flags}
                flagClipsByFlagId={flagClipsByFlagId}
                setFlagClipsByFlagId={setFlagClipsByFlagId}
                selectedFlagId={selectedFlagId}
                setSelectedFlagId={setSelectedFlagId}
              />
            </div>

            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                className="rounded-xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
                onClick={exportProject}
              >
                Export
              </button>
              <button
                className="rounded-xl bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
                onClick={importProject}
              >
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
              <h2 className="text-sm font-semibold text-slate-900">
                Inspector
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Select a boat and adjust properties.
              </p>

              <div className="mt-3 space-y-3">
                <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <div className="text-xs font-medium text-slate-700">
                    Selected Boat
                  </div>

                  {!selectedBoatId || !selectedBoat ? (
                    <div className="mt-2 text-sm text-slate-600">
                      No boat selected.
                    </div>
                  ) : (
                    <div className="mt-2 space-y-3">
                      <label className="block">
                        <div className="text-xs text-slate-600">Label</div>
                        <input
                          className="mt-1 w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-200"
                          value={selectedBoat.label}
                          onChange={(e) =>
                            updateSelectedBoat({ label: e.target.value })
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
                            updateSelectedBoat({ color: e.target.value })
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
                              updateSelectedBoat({ x: Number(e.target.value) })
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
                              updateSelectedBoat({ y: Number(e.target.value) })
                            }
                          />
                        </label>
                      </div>

                      <label className="block">
                        <div className="text-xs text-slate-600">
                          Heading (deg)
                        </div>
                        <input
                          className="mt-1 w-full"
                          type="range"
                          min={0}
                          max={359}
                          step={1}
                          value={Math.round(selectedBoat.headingDeg) % 360}
                          onChange={(e) =>
                            updateSelectedBoat({
                              headingDeg: Number(e.target.value),
                            })
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
                              hdg: {displayedForInspector.headingDeg.toFixed(1)}
                              °
                            </div>
                            <div>
                              steps:{" "}
                              {(stepsByBoatId[selectedBoatId] || []).length}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <div className="text-xs font-medium text-slate-700">
                    Project JSON
                  </div>
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
      </div>
    </div>
  );
}
