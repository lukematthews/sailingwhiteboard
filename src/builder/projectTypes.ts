// src/builder/projectTypes.ts
import type {
  Boat,
  Flag,
  FlagClipsByFlagId,
  KeyframesByBoatId,
  Mark,
  StartLine,
  Wind,
} from "../types";

export const DEFAULT_DURATION_MS = 12000;
export const DEFAULT_FPS = 60;

export type ProjectFile = {
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
