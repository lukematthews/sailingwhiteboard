// src/builder/useProjectIO.ts
import { useCallback } from "react";
import type {
  Boat,
  Flag,
  FlagClipsByFlagId,
  KeyframesByBoatId,
  Mark,
  StartLine,
  Wind,
} from "../types";
import { DEFAULT_START_LINE } from "../canvas/defaults";
import {
  DEFAULT_DURATION_MS,
  DEFAULT_FPS,
  type ProjectFile,
} from "./projectTypes";

type Args = {
  durationMs: number;
  fps: number;
  boats: Boat[];
  keyframesByBoatId: KeyframesByBoatId;
  marks: Mark[];
  wind: Wind;
  startLine: StartLine;
  flags: Flag[];
  flagClipsByFlagId: FlagClipsByFlagId;

  setDurationMs: (v: number) => void;
  setFps: (v: number) => void;
  setBoats: React.Dispatch<React.SetStateAction<Boat[]>>;
  setKeyframesByBoatId: React.Dispatch<React.SetStateAction<KeyframesByBoatId>>;
  setMarks: React.Dispatch<React.SetStateAction<Mark[]>>;
  setWind: React.Dispatch<React.SetStateAction<Wind>>;
  setStartLine: React.Dispatch<React.SetStateAction<StartLine>>;
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

export function useProjectIO(args: Args) {
  const {
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
  } = args;

  const exportProject = useCallback(() => {
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
  }, [
    durationMs,
    fps,
    boats,
    keyframesByBoatId,
    marks,
    wind,
    startLine,
    flags,
    flagClipsByFlagId,
    setExportText,
  ]);

  const importProject = useCallback(() => {
    try {
      const parsed = JSON.parse(exportText) as Partial<ProjectFile> & {
        flagVisibilityById?: unknown;
      };
      if (!parsed || typeof parsed !== "object") return;

      setDurationMs(
        typeof parsed.durationMs === "number"
          ? parsed.durationMs
          : DEFAULT_DURATION_MS,
      );
      setFps(typeof parsed.fps === "number" ? parsed.fps : DEFAULT_FPS);

      setBoats(Array.isArray(parsed.boats) ? (parsed.boats as Boat[]) : []);
      setKeyframesByBoatId(
        parsed.keyframesByBoatId && typeof parsed.keyframesByBoatId === "object"
          ? (parsed.keyframesByBoatId as KeyframesByBoatId)
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
    } catch {
      // ignore parse errors
    }
  }, [
    exportText,
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
  ]);

  return { exportProject, importProject };
}
