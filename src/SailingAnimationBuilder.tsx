// src/SailingAnimationBuilder.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { clamp } from "./lib/math";
import { uid } from "./lib/ids";

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

import BuilderHeader from "./builder/BuilderHeader";
import TimelineSettingsBar from "./builder/TimelineSettingsBar";
import InspectorPanel from "./builder/InspectorPanel";
import { ensureStartSteps } from "./builder/ensureStartSteps";
import { useTimeline } from "./builder/useTimeline";
import { useProjectIO } from "./builder/useProjectIO";
import { useCanvasDraw } from "./builder/useCanvasDraw";
import { useCanvasInteractions } from "./builder/useCanvasInteractions";

export default function SailingAnimationBuilder() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // --- timeline (moved to hook; identical behavior) ---
  const {
    durationMs,
    setDurationMs,
    fps,
    setFps,
    timeMs,
    setTimeMs,
    isPlaying,
    setIsPlaying,
    playbackRate,
    setPlaybackRate,
  } = useTimeline();

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

  // --- draw (moved to hook; identical behavior) ---
  useCanvasDraw({
    canvasRef,
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
  });

  // --- pointer interactions (moved to hook; identical behavior) ---
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

  // --- import/export (moved to hook; identical behavior) ---
  const [exportText, setExportText] = useState("");

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
        <BuilderHeader
          tool={tool}
          setTool={setTool}
          snapToGrid={snapToGrid}
          setSnapToGrid={setSnapToGrid}
          selectedBoatId={selectedBoatId}
          onAddBoat={addBoat}
          onDeleteSelectedBoat={deleteSelectedBoat}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
          <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
            <div
              ref={wrapRef}
              className="relative aspect-[16/10] w-full overflow-hidden rounded-xl ring-1 ring-slate-200 touch-none"
            >
              <canvas ref={canvasRef} className="h-full w-full touch-none" />
            </div>
            <TimelineSettingsBar
              durationSeconds={Math.round(durationMs / 1000)}
              fps={fps}
              onDurationSecondsChange={(s) => {
                const ms = clamp(s * 1000, 1000, 120000);
                setDurationMs(ms);
                setTimeMs((t) => clamp(t, 0, ms));
              }}
              onFpsChange={(nextFps) => setFps(clamp(nextFps, 12, 120))}
            />

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
            <InspectorPanel
              selectedBoatId={selectedBoatId}
              selectedBoat={selectedBoat}
              onUpdateSelectedBoat={updateSelectedBoat}
              displayedForInspector={displayedForInspector}
              stepsCountForSelectedBoat={
                selectedBoatId
                  ? (stepsByBoatId[selectedBoatId] || []).length
                  : 0
              }
              exportText={exportText}
              setExportText={setExportText}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
