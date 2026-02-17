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
      return scenarioFiveBoatStartRack();
    // return scenarioStartSequence();
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
  const durationMs = 120000;
  const fps = 10;

  // ✅ Start line: higher + ~double length, swapped ends (pin left, committee right)
  const yLine = 240; // higher on canvas
  const pin = { x: 80, y: yLine };
  const committee = { x: 880, y: yLine };

  // Boats
  const b1 = uid();
  const b2 = uid();
  const b3 = uid();
  const b4 = uid();
  const b5 = uid();

  // Flags
  const orange = uid();
  const classFlag = uid();
  const prepP = uid();

  // Timing: scaled “sequence” inside 0..60s, then sail 60..80s upwind
  const START_MS = 60000;
  const SAIL_UPCOURSE_END_MS = 80000;

  const CLASS_UP_MS = 10000;
  const CLASS_DOWN_MS = 60000;
  const P_UP_MS = 20000;
  const P_DOWN_MS = 50000;

  const CLASS_CODE = "U" as any; // <-- replace with your actual class flag code if needed

  // Helpers for “45° starboard tack” after start:
  // y decreases (up the screen), x increases (to the right) with similar magnitude.
  const upwindDx = -140;
  const upwindDy = 140;

  // Rack/stage y just below the line (line is at y=240)
  const rackY = 275;
  const preStartY = 305;

  // Give each boat its own "slot" along the line to reduce collisions.
  const slotXs = [220, 360, 500, 640, 780];

  return {
    ...baseProject(),
    durationMs,
    fps,
    marks: [],
    wind: { fromDeg: 0, speedKt: 15 },
    startLine: { committee, pin, startBoatId: null },

    flags: [
      { id: orange, code: "O", x: 90, y: 120 },
      { id: classFlag, code: CLASS_CODE, x: 90, y: 160 },
      { id: prepP, code: "P", x: 90, y: 200 },
    ],

    // ✅ Clips per your spec
    flagClipsByFlagId: {
      [orange]: [{ id: uid(), startMs: 0, endMs: durationMs, code: "orange" }],
      [classFlag]: [
        { id: uid(), startMs: CLASS_UP_MS, endMs: CLASS_DOWN_MS, code: CLASS_CODE },
      ],
      [prepP]: [
        { id: uid(), startMs: P_UP_MS, endMs: P_DOWN_MS, code: "P" },
      ],
    },

    // Start boats off-screen-ish so they “arrive”
    boats: [
      { id: b1, label: "Boat 1", color: "#22c55e", x: -140, y: 520, headingDeg: 0 },
      { id: b2, label: "Boat 2", color: "#3b82f6", x: 1100, y: 520, headingDeg: 0 },
      { id: b3, label: "Boat 3", color: "#ef4444", x: 500, y: 820, headingDeg: 0 },
      { id: b4, label: "Boat 4", color: "#f59e0b", x: -220, y: 120, headingDeg: 90 },
      { id: b5, label: "Boat 5", color: "#a855f7", x: 1180, y: 120, headingDeg: 270 },
    ],

    stepsByBoatId: {
      [b1]: [
        // enter + converge + rack into slot 1
        { id: uid(), tMs: 0, x: -140, y: 520, headingMode: "auto" },
        { id: uid(), tMs: 20000, x: 140, y: 440, headingMode: "auto" },
        { id: uid(), tMs: 42000, x: slotXs[0] - 10, y: preStartY + 20, headingMode: "auto" },
        { id: uid(), tMs: 52000, x: slotXs[0], y: rackY + 18, headingMode: "auto" },
        { id: uid(), tMs: 56000, x: slotXs[0] - 8, y: rackY + 26, headingMode: "auto" }, // rack back
        { id: uid(), tMs: 59000, x: slotXs[0] + 6, y: rackY + 20, headingMode: "auto" }, // creep
        // ✅ start at 60s: pop to/over line
        { id: uid(), tMs: START_MS, x: slotXs[0], y: yLine - 6, headingMode: "auto" },
        // ✅ sail upwind 20s on starboard tack (~45°): dx ≈ -dy
        { id: uid(), tMs: SAIL_UPCOURSE_END_MS, x: slotXs[0] + upwindDx, y: (yLine - 6) - upwindDy, headingMode: "auto" },
        // keep going
        { id: uid(), tMs: 100000, x: slotXs[0] + upwindDx - 120, y: (yLine - 6) - upwindDy - 120, headingMode: "auto" },
        { id: uid(), tMs: 120000, x: slotXs[0] + upwindDx - 220, y: (yLine - 6) - upwindDy - 220, headingMode: "auto" },
      ],

      [b2]: [
        { id: uid(), tMs: 0, x: 1100, y: 520, headingMode: "auto" },
        { id: uid(), tMs: 20000, x: 860, y: 440, headingMode: "auto" },
        { id: uid(), tMs: 42000, x: slotXs[4] + 10, y: preStartY + 22, headingMode: "auto" },
        { id: uid(), tMs: 52000, x: slotXs[4], y: rackY + 16, headingMode: "auto" },
        { id: uid(), tMs: 56000, x: slotXs[4] + 10, y: rackY + 24, headingMode: "auto" },
        { id: uid(), tMs: 59000, x: slotXs[4] - 8, y: rackY + 18, headingMode: "auto" },
        { id: uid(), tMs: START_MS, x: slotXs[4], y: yLine - 6, headingMode: "auto" },
        { id: uid(), tMs: SAIL_UPCOURSE_END_MS, x: slotXs[4] + upwindDx, y: (yLine - 6) - upwindDy, headingMode: "auto" },
        { id: uid(), tMs: 100000, x: slotXs[4] + upwindDx - 120, y: (yLine - 6) - upwindDy - 120, headingMode: "auto" },
        { id: uid(), tMs: 120000, x: slotXs[4] + upwindDx - 220, y: (yLine - 6) - upwindDy - 220, headingMode: "auto" },
      ],

      [b3]: [
        { id: uid(), tMs: 0, x: 500, y: 820, headingMode: "auto" },
        { id: uid(), tMs: 18000, x: 500, y: 620, headingMode: "auto" },
        { id: uid(), tMs: 42000, x: slotXs[2], y: preStartY + 28, headingMode: "auto" },
        { id: uid(), tMs: 52000, x: slotXs[2], y: rackY + 20, headingMode: "auto" },
        { id: uid(), tMs: 56000, x: slotXs[2] + 12, y: rackY + 28, headingMode: "auto" }, // lateral rack
        { id: uid(), tMs: 59000, x: slotXs[2] - 10, y: rackY + 22, headingMode: "auto" },
        { id: uid(), tMs: START_MS, x: slotXs[2], y: yLine - 6, headingMode: "auto" },
        { id: uid(), tMs: SAIL_UPCOURSE_END_MS, x: slotXs[2] + upwindDx, y: (yLine - 6) - upwindDy, headingMode: "auto" },
        { id: uid(), tMs: 100000, x: slotXs[2] + upwindDx - 120, y: (yLine - 6) - upwindDy - 120, headingMode: "auto" },
        { id: uid(), tMs: 120000, x: slotXs[2] + upwindDx - 220, y: (yLine - 6) - upwindDy - 220, headingMode: "auto" },
      ],

      [b4]: [
        { id: uid(), tMs: 0, x: -220, y: 120, headingMode: "auto" },
        { id: uid(), tMs: 20000, x: 140, y: 190, headingMode: "auto" },
        { id: uid(), tMs: 42000, x: slotXs[1] - 20, y: preStartY + 14, headingMode: "auto" },
        { id: uid(), tMs: 52000, x: slotXs[1], y: rackY + 12, headingMode: "auto" },
        { id: uid(), tMs: 56000, x: slotXs[1] - 12, y: rackY + 20, headingMode: "auto" },
        { id: uid(), tMs: 59000, x: slotXs[1] + 8, y: rackY + 14, headingMode: "auto" },
        { id: uid(), tMs: START_MS, x: slotXs[1], y: yLine - 6, headingMode: "auto" },
        { id: uid(), tMs: SAIL_UPCOURSE_END_MS, x: slotXs[1] + upwindDx, y: (yLine - 6) - upwindDy, headingMode: "auto" },
        { id: uid(), tMs: 100000, x: slotXs[1] + upwindDx - 120, y: (yLine - 6) - upwindDy - 120, headingMode: "auto" },
        { id: uid(), tMs: 120000, x: slotXs[1] + upwindDx - 220, y: (yLine - 6) - upwindDy - 220, headingMode: "auto" },
      ],

      [b5]: [
        { id: uid(), tMs: 0, x: 1180, y: 120, headingMode: "auto" },
        { id: uid(), tMs: 20000, x: 860, y: 190, headingMode: "auto" },
        { id: uid(), tMs: 42000, x: slotXs[3] + 20, y: preStartY + 16, headingMode: "auto" },
        { id: uid(), tMs: 52000, x: slotXs[3], y: rackY + 12, headingMode: "auto" },
        { id: uid(), tMs: 56000, x: slotXs[3] + 14, y: rackY + 20, headingMode: "auto" },
        { id: uid(), tMs: 59000, x: slotXs[3] - 10, y: rackY + 14, headingMode: "auto" },
        { id: uid(), tMs: START_MS, x: slotXs[3], y: yLine - 6, headingMode: "auto" },
        { id: uid(), tMs: SAIL_UPCOURSE_END_MS, x: slotXs[3] + upwindDx, y: (yLine - 6) - upwindDy, headingMode: "auto" },
        { id: uid(), tMs: 100000, x: slotXs[3] + upwindDx - 120, y: (yLine - 6) - upwindDy - 120, headingMode: "auto" },
        { id: uid(), tMs: 120000, x: slotXs[3] + upwindDx - 220, y: (yLine - 6) - upwindDy - 220, headingMode: "auto" },
      ],
    },
  };
}