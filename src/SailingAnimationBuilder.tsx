// src/SailingAnimationBuilder.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import RightSidebar from "./builder/RightSidebar";
import TimelinePanel from "./builder/TimelinePanel";

import { ensureStartSteps } from "./builder/ensureStartSteps";
import { useTimeline } from "./builder/useTimeline";
import { useProjectIO } from "./builder/useProjectIO";
import { useCanvasDraw } from "./builder/useCanvasDraw";
import { useCanvasInteractions } from "./builder/useCanvasInteractions";
import { useCanvasPanZoom } from "./builder/useCameraPanZoom";

import AudioScrubberBar from "./components/dopesheet/AudioScrubberBar";

import { WelcomeOverlay } from "./builder/WelcomeOverlay";
import { getScenarioProjectFile, ScenarioKey } from "./builder/scenarios";

import type { Camera } from "./builder/camera";

import { hitTestBoat } from "./canvas/hitTest";
import { hitTestMark } from "./canvas/marks";
import { hitTestStartHandle } from "./canvas/startLine";
import { hitTestFlag, resolveActiveFlagCode } from "./canvas/flags";

const WELCOME_HIDE_KEY = "swb_welcome_hide";

export default function SailingAnimationBuilder() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // ---------------------------------------------------------------------------
  // Timeline
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Camera (Pan/Zoom)
  // ---------------------------------------------------------------------------
  const [camera, setCamera] = useState<Camera>({
    x: 0,
    y: 0,
    zoom: 1,
  });

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [autoKey] = useState<boolean>(true);
  const [segmentsByBoatId] = useState<SegmentsByBoatId>(() => ({}));

  // asset tick for async SVG flags
  const [assetTick, setAssetTick] = useState(0);
  useEffect(() => {
    const h = () => setAssetTick((t) => t + 1);
    window.addEventListener("flagassetloaded", h);
    return () => window.removeEventListener("flagassetloaded", h);
  }, []);

  const [boats, setBoats] = useState<Boat[]>(() => DEFAULT_BOATS);

  const [keyframesByBoatId, setKeyframesByBoatId] = useState<KeyframesByBoatId>(
    () => ({}),
  );

  const [stepsByBoatId, setStepsByBoatId] = useState<StepsByBoatId>(() => ({}));

  useEffect(() => {
    setStepsByBoatId((prev) => ensureStartSteps(boats, prev));
  }, [boats]);

  // ---------------------------------------------------------------------------
  // Visibility toggles
  // ---------------------------------------------------------------------------
  const [showStartLine, setShowStartLine] = useState(true);
  const [showMarks, setShowMarks] = useState(true);
  const [showMarkThreeBL, setShowMarkThreeBL] = useState(false);
  const [showBoatTransomLines, setShowBoatTransomLines] = useState(false);

  // ---------------------------------------------------------------------------
  // Course
  // ---------------------------------------------------------------------------
  const [marks, setMarks] = useState<Mark[]>(() => DEFAULT_MARKS);
  const [wind, setWind] = useState<Wind>(() => ({
    fromDeg: 0,
    speedKt: 15,
  }));

  const [startLine, setStartLine] = useState<StartLine>(
    () => DEFAULT_START_LINE,
  );

  // ---------------------------------------------------------------------------
  // Flags
  // ---------------------------------------------------------------------------
  const [flags, setFlags] = useState<Flag[]>([]);
  const [flagClipsByFlagId, setFlagClipsByFlagId] = useState<FlagClipsByFlagId>(
    () => ({}),
  );

  const [selectedFlagId, setSelectedFlagId] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Selection + Tool
  // ---------------------------------------------------------------------------
  const [selectedBoatId, setSelectedBoatId] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolMode>("select");
  const [snapToGrid, setSnapToGrid] = useState(true);

  const selectedBoat = useMemo(
    () => boats.find((b) => b.id === selectedBoatId) || null,
    [boats, selectedBoatId],
  );

  // ---------------------------------------------------------------------------
  // Displayed boats (interpolated at playhead)
  // ---------------------------------------------------------------------------
  const displayedBoats = useMemo(() => {
    return interpolateBoatsAtTimeFromSteps(
      boats,
      stepsByBoatId,
      segmentsByBoatId,
      timeMs,
    );
  }, [boats, stepsByBoatId, segmentsByBoatId, timeMs]);

  // ---------------------------------------------------------------------------
  // Draw
  // ---------------------------------------------------------------------------
  useCanvasDraw({
    canvasRef,
    camera,
    boats,
    displayedBoats,
    stepsByBoatId,
    segmentsByBoatId,
    timeMs,
    durationMs,
    fps,
    selectedBoatId,
    isPlaying,
    wind,
    showMarks,
    marks,
    showStartLine,
    startLine,
    showMarkThreeBL,
    showBoatTransomLines,
    flags,
    flagClipsByFlagId,
    selectedFlagId,
    assetTick,
  });

  // ---------------------------------------------------------------------------
  // Interactions (boats/marks/startline/flags)
  // ---------------------------------------------------------------------------
  useCanvasInteractions({
    canvasRef,
    camera,
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

  // ---------------------------------------------------------------------------
  // Pan only on EMPTY SPACE (whiteboard style)
  // ---------------------------------------------------------------------------

  const displayedBoatsRef = useRef(displayedBoats);
  const marksRef = useRef(marks);
  const flagsRef = useRef(flags);
  const timeRef = useRef(timeMs);

  useEffect(
    () => void (displayedBoatsRef.current = displayedBoats),
    [displayedBoats],
  );
  useEffect(() => void (marksRef.current = marks), [marks]);
  useEffect(() => void (flagsRef.current = flags), [flags]);
  useEffect(() => void (timeRef.current = timeMs), [timeMs]);

  const shouldStartPan = useCallback(
    (pWorld: { x: number; y: number }) => {
      // ❌ boats
      for (const b of displayedBoatsRef.current) {
        if (hitTestBoat(pWorld.x, pWorld.y, b)) return false;
      }

      // ❌ marks
      if (showMarks) {
        for (const m of marksRef.current) {
          if (hitTestMark(pWorld.x, pWorld.y, m)) return false;
        }
      }

      // ❌ start line handles
      if (showStartLine) {
        if (hitTestStartHandle(pWorld.x, pWorld.y, startLine)) return false;
      }

      // ❌ flags
      for (const f of flagsRef.current) {
        const codeNow = resolveActiveFlagCode(
          f,
          flagClipsByFlagId[f.id],
          timeRef.current,
        );
        if (!codeNow) continue;

        if (hitTestFlag(pWorld.x, pWorld.y, f)) return false;
      }

      // ✅ empty space
      return true;
    },
    [showMarks, showStartLine, startLine, flagClipsByFlagId],
  );

  useCanvasPanZoom({
    canvasRef,
    camera,
    setCamera,
    shouldStartPan,
  });

  // ---------------------------------------------------------------------------
  // Import / Export
  // ---------------------------------------------------------------------------
  const [exportText, setExportText] = useState("");

  const { loadProject } = useProjectIO({
    durationMs,
    fps,
    boats,
    keyframesByBoatId,
    stepsByBoatId,
    marks,
    wind,
    startLine,
    flags,
    flagClipsByFlagId,

    setDurationMs,
    setFps,
    setBoats,
    setKeyframesByBoatId,
    setStepsByBoatId,
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

  // ---------------------------------------------------------------------------
  // Welcome Overlay
  // ---------------------------------------------------------------------------
  const [dontShowWelcome, setDontShowWelcome] = useState(() => {
    try {
      return localStorage.getItem(WELCOME_HIDE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const [showWelcome, setShowWelcome] = useState(() => {
    try {
      return localStorage.getItem(WELCOME_HIDE_KEY) !== "1";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(WELCOME_HIDE_KEY, dontShowWelcome ? "1" : "0");
    } catch {}
  }, [dontShowWelcome]);

  const loadScenario = useCallback(
    (key: ScenarioKey) => {
      setShowWelcome(false);
      setIsPlaying(false);
      setTimeMs(0);

      const project = getScenarioProjectFile(key);
      loadProject(project);

      if (key === "blank") {
        setSelectedBoatId(null);
        setSelectedFlagId(null);
      }
    },
    [loadProject, setIsPlaying, setTimeMs],
  );

  // ---------------------------------------------------------------------------
  // Boat CRUD
  // ---------------------------------------------------------------------------
  const getCanvasCenter = () => {
    const el = wrapRef.current;
    if (!el) return { x: 500, y: 250 };
    const r = el.getBoundingClientRect();
    return { x: r.width / 2, y: r.height / 2 };
  };

  const addBoat = () => {
    const id = uid();
    const c = getCanvasCenter();

    setBoats((prev) => [
      ...prev,
      {
        id,
        label: `Boat ${prev.length + 1}`,
        color: "#22c55e",
        x: c.x,
        y: c.y,
        headingDeg: 0,
      },
    ]);

    setSelectedBoatId(id);
  };

  const deleteSelectedBoat = () => {
    if (!selectedBoatId) return;

    setBoats((prev) => prev.filter((b) => b.id !== selectedBoatId));
    setSelectedBoatId(null);
  };

  const updateSelectedBoat = (patch: Partial<Boat>) => {
    if (!selectedBoatId) return;
    setBoats((prev) =>
      prev.map((b) => (b.id === selectedBoatId ? { ...b, ...patch } : b)),
    );
  };

  const displayedForInspector = useMemo(() => {
    if (!selectedBoatId) return null;
    return displayedBoats.find((b) => b.id === selectedBoatId) || null;
  }, [displayedBoats, selectedBoatId]);

  const boatsOptions = useMemo(
    () => boats.map((b) => ({ id: b.id, label: b.label })),
    [boats],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
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

      {/* MAIN */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* CANVAS */}
          <div className="relative flex-1 bg-white">
            <div ref={wrapRef} className="absolute inset-0">
              <canvas ref={canvasRef} className="h-full w-full" />
            </div>
          </div>

          {/* SCRUB */}
          <AudioScrubberBar
            timeMs={timeMs}
            durationMs={durationMs}
            scrubberStep={50}
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
          />
          
          {/* TIMELINE */}
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
                marks={marks}
                setMarks={setMarks}
                wind={wind}
                setWind={setWind}
                startLine={startLine}
                setStartLine={setStartLine}
                boatsOptions={boatsOptions}
                showStartLine={showStartLine}
                setShowStartLine={setShowStartLine}
                showMarks={showMarks}
                setShowMarks={setShowMarks}
                showMarkThreeBL={showMarkThreeBL}
                setShowMarkThreeBL={setShowMarkThreeBL}
                showBoatTransomLines={showBoatTransomLines}
                setShowBoatTransomLines={setShowBoatTransomLines}
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

      {/* WELCOME */}
      <WelcomeOverlay
        open={showWelcome}
        dontShowAgain={dontShowWelcome}
        onDontShowAgainChange={setDontShowWelcome}
        onClose={() => setShowWelcome(false)}
        onPickScenario={loadScenario}
      />
    </div>
  );
}
