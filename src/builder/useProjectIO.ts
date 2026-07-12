// src/builder/useProjectIO.ts
import { useCallback } from "react";
import type {
  Boat,
  Flag,
  FlagClipsByFlagId,
  KeyframesByBoatId,
  Mark,
  StepsByBoatId,
  StartLine,
  Wind,
} from "../types";
import { DEFAULT_START_LINE } from "../canvas/defaults";
import {
  DEFAULT_DURATION_MS,
  DEFAULT_FPS,
  type ProjectFile,
} from "./projectTypes";

/**
 * ✅ Scenario import/export wrapper.
 *
 * We still support importing raw ProjectFile JSON (older exports).
 * But new exports are wrapped as:
 *
 * {
 *   "type": "scenario",
 *   "schemaVersion": 1,
 *   "scenario": { "title": "...", "description": "...", "key": "optional" },
 *   "project": { ...ProjectFile... }
 * }
 */
export type ScenarioFile = {
  type: "scenario";
  schemaVersion: 1;
  scenario?: {
    title?: string;
    description?: string;
    key?: string;
    createdAtIso?: string;
  };
  /** Scenario-driven UI defaults (optional). */
  ui?: {
    /** Whether the start line should be visible when this scenario is loaded. */
    showStartLine?: boolean;
  };
  project: ProjectFile;
};

type Args = {
  durationMs: number;
  fps: number;
  boats: Boat[];
  keyframesByBoatId: KeyframesByBoatId;
  stepsByBoatId: StepsByBoatId;
  marks: Mark[];
  wind: Wind;
  startLine: StartLine;
  showStartLine: boolean;
  flags: Flag[];
  flagClipsByFlagId: FlagClipsByFlagId;

  setDurationMs: (v: number) => void;
  setFps: (v: number) => void;
  setBoats: React.Dispatch<React.SetStateAction<Boat[]>>;
  setKeyframesByBoatId: React.Dispatch<React.SetStateAction<KeyframesByBoatId>>;
  setStepsByBoatId: React.Dispatch<React.SetStateAction<StepsByBoatId>>;
  setMarks: React.Dispatch<React.SetStateAction<Mark[]>>;
  setWind: React.Dispatch<React.SetStateAction<Wind>>;
  setStartLine: React.Dispatch<React.SetStateAction<StartLine>>;
  setShowStartLine: (v: boolean) => void;
  setFlags: React.Dispatch<React.SetStateAction<Flag[]>>;
  setFlagClipsByFlagId: React.Dispatch<React.SetStateAction<FlagClipsByFlagId>>;

  setTimeMs: (t: number) => void;
  setIsPlaying: (p: boolean) => void;
  setSelectedBoatId: (id: string | null) => void;
  setSelectedFlagId: (id: string | null) => void;

  // controlled by caller (SAB)
  exportText: string;
  setExportText: (s: string) => void;
};

function isScenarioFile(v: unknown): v is ScenarioFile {
  if (!v || typeof v !== "object") return false;
  const anyV = v as any;
  return anyV.type === "scenario" && anyV.schemaVersion === 1 && anyV.project;
}

export function useProjectIO(args: Args) {
  const {
    durationMs,
    fps,
    boats,
    keyframesByBoatId,
    stepsByBoatId,
    marks,
    wind,
    startLine,
    showStartLine,
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
    setShowStartLine,
    setFlags,
    setFlagClipsByFlagId,

    setTimeMs,
    setIsPlaying,
    setSelectedBoatId,
    setSelectedFlagId,

    exportText,
    setExportText,
  } = args;

  const exportProject = useCallback(() => {
    const project: ProjectFile = {
      version: 4,
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
    };

    const scenario: ScenarioFile = {
      type: "scenario",
      schemaVersion: 1,
      scenario: {
        title: "Custom Scenario",
        createdAtIso: new Date().toISOString(),
      },
      ui: {
        showStartLine,
      },
      project,
    };

    setExportText(JSON.stringify(scenario, null, 2));
  }, [
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
    showStartLine,
    setExportText,
  ]);

  const applyProject = useCallback(
    (parsed: Partial<ProjectFile> & { flagVisibilityById?: unknown }) => {
      setDurationMs(
        typeof parsed.durationMs === "number" && parsed.durationMs > 0
          ? parsed.durationMs
          : DEFAULT_DURATION_MS,
      );
      setFps(
        typeof parsed.fps === "number" && parsed.fps > 0
          ? parsed.fps
          : DEFAULT_FPS,
      );

      setBoats(Array.isArray(parsed.boats) ? (parsed.boats as Boat[]) : []);

      setKeyframesByBoatId(
        parsed.keyframesByBoatId && typeof parsed.keyframesByBoatId === "object"
          ? (parsed.keyframesByBoatId as KeyframesByBoatId)
          : {},
      );

      // ✅ v4+: steps-based animation lanes
      setStepsByBoatId(
        parsed.stepsByBoatId && typeof parsed.stepsByBoatId === "object"
          ? (parsed.stepsByBoatId as StepsByBoatId)
          : {},
      );

      setMarks(Array.isArray(parsed.marks) ? (parsed.marks as Mark[]) : []);

      setWind(
        parsed.wind && typeof parsed.wind === "object"
          ? (parsed.wind as Wind)
          : { fromDeg: 210, speedKt: 18 },
      );

      setStartLine(
        parsed.startLine && typeof parsed.startLine === "object"
          ? (parsed.startLine as StartLine)
          : { ...DEFAULT_START_LINE, startBoatId: null },
      );

      setFlags(Array.isArray(parsed.flags) ? (parsed.flags as Flag[]) : []);

      // Back-compat: older save format used `flagVisibilityById`
      const clips =
        (parsed.flagClipsByFlagId &&
        typeof parsed.flagClipsByFlagId === "object"
          ? (parsed.flagClipsByFlagId as FlagClipsByFlagId)
          : null) ??
        (parsed.flagVisibilityById &&
        typeof parsed.flagVisibilityById === "object"
          ? (parsed.flagVisibilityById as FlagClipsByFlagId)
          : {});

      setFlagClipsByFlagId(clips);

      // reset timeline/selection
      setTimeMs(0);
      setIsPlaying(false);
      setSelectedBoatId(null);
      setSelectedFlagId(null);
    },
    [
      setBoats,
      setDurationMs,
      setFlagClipsByFlagId,
      setFlags,
      setFps,
      setIsPlaying,
      setKeyframesByBoatId,
      setMarks,
      setSelectedBoatId,
      setSelectedFlagId,
      setStartLine,
      setStepsByBoatId,
      setTimeMs,
      setWind,
    ],
  );

  const loadProject = useCallback(
    (project: ProjectFile) => {
      applyProject(project);

      const scenario: ScenarioFile = {
        type: "scenario",
        schemaVersion: 1,
        scenario: {
          title: "Loaded Scenario",
          createdAtIso: new Date().toISOString(),
        },
        ui: {
          showStartLine,
        },
        project,
      };

      setExportText(JSON.stringify(scenario, null, 2));
    },
    [applyProject, setExportText, showStartLine],
  );

  const importProject = useCallback(
    (text?: string) => {
      try {
        const source = typeof text === "string" ? text : exportText;
        const parsed = JSON.parse(source) as unknown;

        if (!parsed || typeof parsed !== "object") return;

        // ✅ New scenario wrapper
        if (isScenarioFile(parsed)) {
          const sf = parsed as ScenarioFile;
          if (typeof sf.ui?.showStartLine === "boolean") {
            setShowStartLine(sf.ui.showStartLine);
          }
          applyProject(sf.project);
          return;
        }

        // ✅ Old raw ProjectFile
        applyProject(parsed as Partial<ProjectFile> & { flagVisibilityById?: unknown });
      } catch {
        // ignore parse errors
      }
    },
    [applyProject, exportText, setShowStartLine],
  );

  return { exportProject, importProject, loadProject };
}
