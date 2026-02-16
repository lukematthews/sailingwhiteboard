// src/SailingAnimationBuilder.tsx
import { useEffect, useMemo, useRef, useState } from "react";
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
import InspectorPanel from "./builder/InspectorPanel";
import { ensureStartSteps } from "./builder/ensureStartSteps";
import { useTimeline } from "./builder/useTimeline";
import { useProjectIO } from "./builder/useProjectIO";
import { useCanvasDraw } from "./builder/useCanvasDraw";
import { useCanvasInteractions } from "./builder/useCanvasInteractions";
import RightSidebar from "./builder/RightSidebar";
import TimelinePanel from "./builder/TimelinePanel";
import AudioScrubberBar from "./components/dopesheet/AudioScrubberBar";

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

  const [showStartLine, setShowStartLine] = useState(true);
  const [showMarks, setShowMarks] = useState(true);

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
    displayedBoats,
    stepsByBoatId,
    segmentsByBoatId,
    timeMs,
    durationMs,
    fps,
    selectedBoatId,
    wind, // ✅ always
    showMarks,
    marks,
    showStartLine,
    startLine,
    flags,
    flagClipsByFlagId,
    selectedFlagId,
    assetTick,
  });
  // --- pointer interactions (moved to hook; identical behavior) ---
  useCanvasInteractions({
    canvasRef,
    autoKey,
    tool,
    snapToGrid,
    timeMs,
    fps,
    showMarks,
    showStartLine,
    marks,
    startLine,
    isPlaying,
    setIsPlaying,
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
    <div className="h-screen w-screen overflow-hidden bg-slate-100 flex flex-col">
      {/* HEADER */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
        <BuilderHeader
          tool={tool}
          setTool={setTool}
          snapToGrid={snapToGrid}
          setSnapToGrid={setSnapToGrid}
          selectedBoatId={selectedBoatId}
          onAddBoat={addBoat}
          onDeleteSelectedBoat={deleteSelectedBoat}
        />
      </div>

      {/* MAIN AREA */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDE (Canvas + Timeline) */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* CANVAS */}
          <div className="relative flex-1 bg-white">
            <div ref={wrapRef} className="absolute inset-0">
              <canvas ref={canvasRef} className="h-full w-full" />
            </div>
          </div>
          <div>
            <AudioScrubberBar
              timeMs={timeMs}
              durationMs={durationMs}
              scrubberStep={/* whatever you use, e.g. frameStepMs(fps) */ 50}
              onScrubTo={(t) => {
                setIsPlaying(false);
                setTimeMs(t);
              }}
              onJumpStart={() => {
                setIsPlaying(false);
                setTimeMs(0);
              }}
              onTogglePlay={() => setIsPlaying((p) => !p)}
              onJumpEnd={() => {
                setIsPlaying(false);
                setTimeMs(durationMs);
              }}
              isPlaying={isPlaying}
              playbackRate={playbackRate}
              setPlaybackRate={setPlaybackRate}
              ripple={false}
              setRipple={() => {}}
            />
          </div>
          {/* TIMELINE AREA */}
          <div className="shrink-0 border-t border-slate-200 bg-white">
            <div className="px-4 pb-3">
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
                setTimeMs={setTimeMs}
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
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="w-[380px] shrink-0 border-l border-slate-200 bg-white overflow-y-auto">
          <RightSidebar
            timeline={
              <TimelinePanel
                durationMs={durationMs}
                setDurationMs={setDurationMs}
                fps={fps}
                setFps={setFps}
                timeMs={timeMs}
                setTimeMs={setTimeMs}
                isPlaying={isPlaying}
                setIsPlaying={setIsPlaying}
              />
            }
            course={
              <CoursePanel
                wind={wind}
                setWind={setWind}
                showStartLine={showStartLine}
                setShowStartLine={setShowStartLine}
                showMarks={showMarks}
                setShowMarks={setShowMarks}
                startLine={startLine}
                setStartLine={setStartLine}
                boatsOptions={boatsOptions}
                marks={marks}
                setMarks={setMarks}
              />
            }
            flags={
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
            }
            inspector={
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
            }
          />
        </div>
      </div>
    </div>
  );
}
