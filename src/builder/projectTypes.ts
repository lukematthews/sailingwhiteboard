// src/builder/projectTypes.ts
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

export const DEFAULT_DURATION_MS = 12000;
export const DEFAULT_FPS = 60;

export type ProjectFile = {
  /**
   * Project schema version.
   * - v3: legacy keyframes only
   * - v4: keyframes + stepsByBoatId (current animation system)
   */
  version: number;
  durationMs: number;
  fps: number;
  boats: Boat[];
  keyframesByBoatId: KeyframesByBoatId;
  /**
   * ✅ v4+: step-based animation lanes.
   * Optional so we can still import older projects.
   */
  stepsByBoatId?: StepsByBoatId;
  marks: Mark[];
  wind: Wind;
  startLine: StartLine;
  flags: Flag[];
  flagClipsByFlagId: FlagClipsByFlagId;
};
