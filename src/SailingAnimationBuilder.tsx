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
import { ensureStartSteps } from "./builder/ensureStartSteps";
import { useTimeline } from "./builder/useTimeline";
import { useProjectIO } from "./builder/useProjectIO";
import { useCanvasDraw } from "./builder/useCanvasDraw";
import { useCanvasInteractions } from "./builder/useCanvasInteractions";
import RightSidebar from "./builder/RightSidebar";
import TimelinePanel from "./builder/TimelinePanel";
import AudioScrubberBar from "./components/dopesheet/AudioScrubberBar";
import { WelcomeOverlay } from "./builder/WelcomeOverlay";
import { getScenarioProjectFile, ScenarioKey } from "./builder/scenarios";

const WELCOME_HIDE_KEY = "swb_welcome_hide";

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
  const [showMarkThreeBL, setShowMarkThreeBL] = useState(false);
  const [showBoatTransomLines, setShowBoatTransomLines] = useState(false);

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

  const { exportProject, importProject, loadProject } = useProjectIO({
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
  // ✅ Welcome overlay state (localStorage)
  // ---------------------------------------------------------------------------
  const [dontShowWelcome, setDontShowWelcome] = useState<boolean>(() => {
    try {
      return localStorage.getItem(WELCOME_HIDE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const [showWelcome, setShowWelcome] = useState<boolean>(() => {
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

      // Always start scenarios paused at t=0.
      setIsPlaying(false);
      setTimeMs(0);

      const project = getScenarioProjectFile(key);

      // ✅ no JSON, no parsing, no mismatch
      loadProject(project);

      // Optional: blank should start with nothing selected
      if (key === "blank") {
        setSelectedBoatId(null);
        setSelectedFlagId(null);
      }
    },
    [
      loadProject,
      setIsPlaying,
      setSelectedBoatId,
      setSelectedFlagId,
      setTimeMs,
    ],
  );

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
          // optional: if you want a "Welcome" button in the header later:
          // onShowWelcome={() => setShowWelcome(true)}
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

      {/* ✅ WELCOME OVERLAY */}
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
