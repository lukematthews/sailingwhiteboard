// src/builder/scenarios.ts
import { uid } from "../lib/ids";
import type { ProjectFile } from "./projectTypes";

export type ScenarioKey =
  | "start-sequence"
  | "boat-interaction"
  | "protest-replay"
  | "blank"
  | "five-boat-start-rack";

export const SCENARIO_KEYS: ScenarioKey[] = [
  "start-sequence",
  "boat-interaction",
  "protest-replay",
  "five-boat-start-rack",
  "blank",
];

export function getScenarioProjectFile(key: ScenarioKey): ProjectFile {
  switch (key) {
    case "start-sequence":
      return scenarioStartSequence();
    case "boat-interaction":
      return scenarioBoatInteraction();
    case "protest-replay":
      return scenarioProtestReplay();
    case "five-boat-start-rack":
      return scenarioFiveBoatStartRack(); // ✅ add
    case "blank":
      return scenarioBlank();
  }
}

// ---------------------------------------------------------------------------
// Scenario builders
// ---------------------------------------------------------------------------

function baseProject(): Omit<ProjectFile, "boats" | "stepsByBoatId"> {
  return {
    version: 4,
    durationMs: 120000,
    fps: 10,
    keyframesByBoatId: {},
    marks: [
      { id: uid(), name: "Windward", type: "round", x: 520, y: 150 },
      { id: uid(), name: "Leeward", type: "round", x: 280, y: 450 },
    ],
    wind: { fromDeg: 0, speedKt: 15 },
    startLine: {
      committee: { x: 360, y: 360 },
      pin: { x: 480, y: 360 },
      startBoatId: null,
    },
    flags: [],
    flagClipsByFlagId: {},
  };
}

function scenarioStartSequence(): ProjectFile {
  // TODO: implement 5-boat start-line racking + flags (Orange + Class + P)
  return {
    ...baseProject(),
    durationMs: 60000,
    fps: 10,
    boats: [],
    stepsByBoatId: {},
    marks: [],
    wind: { fromDeg: 0, speedKt: 15 },
  };
}

function scenarioBoatInteraction(): ProjectFile {
  // TODO: implement overlap / give-way interaction
  return {
    ...baseProject(),
    durationMs: 60000,
    fps: 10,
    boats: [],
    stepsByBoatId: {},
    marks: [{ id: uid(), name: "Mark", type: "round", x: 440, y: 210 }],
    wind: { fromDeg: 10, speedKt: 14 },
  };
}

function scenarioProtestReplay(): ProjectFile {
  // TODO: implement structured protest replay with a flag clip timeline
  return {
    ...baseProject(),
    durationMs: 90000,
    fps: 10,
    boats: [],
    stepsByBoatId: {},
    marks: [],
    wind: { fromDeg: 0, speedKt: 16 },
  };
}

function scenarioBlank(): ProjectFile {
  return {
    version: 4,
    durationMs: 60000,
    fps: 10,
    boats: [],
    keyframesByBoatId: {},
    stepsByBoatId: {},
    marks: [],
    wind: { fromDeg: 0, speedKt: 15 },
    startLine: {
      committee: { x: 360, y: 360 },
      pin: { x: 480, y: 360 },
      startBoatId: null,
    },
    flags: [],
    flagClipsByFlagId: {},
  };
}

function scenarioFiveBoatStartRack(): ProjectFile {
  // 60 seconds, “last minute” rack-up feel
  const durationMs = 60000;
  const fps = 10;

  // Start line (wider, lower-third)
  const committee = { x: 320, y: 360 };
  const pin = { x: 540, y: 360 };

  // Boats
  const b1 = uid();
  const b2 = uid();
  const b3 = uid();
  const b4 = uid();
  const b5 = uid();

  // Flags: Orange (committee boat), Class flag, then P below
  // (Using codes as simple strings that your flag renderer supports.)
  const orange = uid();
  const classFlag = uid();
  const prepP = uid();

  return {
    ...baseProject(),
    durationMs,
    fps,
    marks: [], // keep it clean: start sequence focus
    wind: { fromDeg: 0, speedKt: 15 },
    startLine: { committee, pin, startBoatId: null },

    flags: [
      { id: orange, code: "O", x: 90, y: 120 },
      { id: classFlag, code: "1", x: 90, y: 160 },
      { id: prepP, code: "P", x: 90, y: 200 },
    ],

    // Show them all throughout the minute so it reads instantly.
    flagClipsByFlagId: {
      [orange]: [{ id: uid(), startMs: 0, endMs: durationMs, code: "O" }],
      [classFlag]: [
        { id: uid(), startMs: 0, endMs: durationMs, code: "1" },
      ],
      [prepP]: [{ id: uid(), startMs: 0, endMs: durationMs, code: "P" }],
    },

    boats: [
      {
        id: b1,
        label: "Boat 1",
        color: "#22c55e",
        x: 120,
        y: 420,
        headingDeg: 0,
      },
      {
        id: b2,
        label: "Boat 2",
        color: "#3b82f6",
        x: 680,
        y: 410,
        headingDeg: 0,
      },
      {
        id: b3,
        label: "Boat 3",
        color: "#ef4444",
        x: 420,
        y: 520,
        headingDeg: 0,
      },
      {
        id: b4,
        label: "Boat 4",
        color: "#f59e0b",
        x: 40,
        y: 280,
        headingDeg: 90,
      },
      {
        id: b5,
        label: "Boat 5",
        color: "#a855f7",
        x: 760,
        y: 300,
        headingDeg: 270,
      },
    ],

    stepsByBoatId: {
      // Idea:
      // - first ~20s: boats enter the scene
      // - 20-50s: converge toward the line, slowing + “racking”
      // - 50-60s: tiny forward/back adjustments right under the line
      // - at 60s: pop just over (or right on) the line

      [b1]: [
        { id: uid(), tMs: 0, x: -60, y: 440, headingMode: "auto" },
        { id: uid(), tMs: 15000, x: 140, y: 410, headingMode: "auto" },
        { id: uid(), tMs: 35000, x: 260, y: 392, headingMode: "auto" },
        { id: uid(), tMs: 50000, x: 300, y: 378, headingMode: "auto" },
        { id: uid(), tMs: 55000, x: 295, y: 382, headingMode: "auto" }, // rack back
        { id: uid(), tMs: 60000, x: 305, y: 352, headingMode: "auto" }, // go!
      ],

      [b2]: [
        { id: uid(), tMs: 0, x: 900, y: 430, headingMode: "auto" },
        { id: uid(), tMs: 15000, x: 640, y: 405, headingMode: "auto" },
        { id: uid(), tMs: 35000, x: 540, y: 390, headingMode: "auto" },
        { id: uid(), tMs: 50000, x: 510, y: 376, headingMode: "auto" },
        { id: uid(), tMs: 56000, x: 515, y: 382, headingMode: "auto" }, // rack back
        { id: uid(), tMs: 60000, x: 505, y: 350, headingMode: "auto" },
      ],

      [b3]: [
        { id: uid(), tMs: 0, x: 420, y: 650, headingMode: "auto" },
        { id: uid(), tMs: 12000, x: 420, y: 500, headingMode: "auto" },
        { id: uid(), tMs: 30000, x: 420, y: 415, headingMode: "auto" },
        { id: uid(), tMs: 47000, x: 420, y: 385, headingMode: "auto" },
        { id: uid(), tMs: 54000, x: 430, y: 390, headingMode: "auto" }, // slide right a touch
        { id: uid(), tMs: 60000, x: 425, y: 352, headingMode: "auto" },
      ],

      [b4]: [
        { id: uid(), tMs: 0, x: -80, y: 260, headingMode: "auto" },
        { id: uid(), tMs: 16000, x: 140, y: 300, headingMode: "auto" },
        { id: uid(), tMs: 34000, x: 240, y: 340, headingMode: "auto" },
        { id: uid(), tMs: 50000, x: 280, y: 372, headingMode: "auto" },
        { id: uid(), tMs: 56000, x: 275, y: 380, headingMode: "auto" }, // rack
        { id: uid(), tMs: 60000, x: 290, y: 354, headingMode: "auto" },
      ],

      [b5]: [
        { id: uid(), tMs: 0, x: 880, y: 280, headingMode: "auto" },
        { id: uid(), tMs: 16000, x: 620, y: 310, headingMode: "auto" },
        { id: uid(), tMs: 34000, x: 540, y: 345, headingMode: "auto" },
        { id: uid(), tMs: 50000, x: 500, y: 374, headingMode: "auto" },
        { id: uid(), tMs: 56000, x: 495, y: 382, headingMode: "auto" }, // rack
        { id: uid(), tMs: 60000, x: 485, y: 353, headingMode: "auto" },
      ],
    },
  };
}
