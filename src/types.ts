export type Boat = {
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
  headingDeg: number;
};

export type BoatState = Pick<Boat, "x" | "y" | "headingDeg">;

export type Keyframe = {
  tMs: number;
  state: BoatState;
};

export type KeyframesByBoatId = Record<string, Keyframe[]>;

export type ToolMode = "select" | "rotate" | "pan";

export type Vec2 = { x: number; y: number };

export type MarkType = "round" | "start" | "finish";

export type Mark = {
  id: string;
  name: string;
  type: MarkType;
  x: number;
  y: number;
  color?: string;
};

export type Wind = {
  // Direction wind is COMING FROM, in degrees (0 = North / up, 90 = East / right)
  fromDeg: number;
  // Optional, purely display/annotation
  speedKt?: number;
};

export type StartLine = {
  // Committee boat end (starboard end) and pin end
  committee: Vec2;
  pin: Vec2;
  // Which boat is the "start boat" (the one that will be positioned for the gun)
  startBoatId: string | null;
};

// ── Flags (overlay, not anchored) ────────────────────────────────────────────
// We support:
// - International Code of Signals (A–Z)
// - Numeral pennants (0–9)
// - Substitutes (S1–S3)
// - Race-control flags (AP, Black, etc.)

export type FlagCode =
  | "AP"
  | "Black"
  | "Blue"
  | "Orange"
  | "S1"
  | "S2"
  | "S3"
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L"
  | "M"
  | "N"
  | "O"
  | "P"
  | "Q"
  | "R"
  | "S"
  | "T"
  | "U"
  | "V"
  | "W"
  | "X"
  | "Y"
  | "Z";

export const FLAG_LIBRARY: { code: FlagCode; label: string }[] = (() => {
  // Build then de-dupe by `code` so we never create duplicate React keys / option values.
  const raw: { code: FlagCode; label: string }[] = [
    // Race-control (common)
    { code: "AP", label: "AP (Postponement)" },
    { code: "P", label: "P (Prep)" },
    { code: "I", label: "I (Round ends)" },
    { code: "Z", label: "Z (20% penalty)" },
    { code: "U", label: "U (20% penalty)" },
    { code: "Black", label: "Black flag" },
    { code: "Blue", label: "Finish flag" },
    { code: "Orange", label: "Start flag" },
    { code: "S", label: "S (Shorten)" },
    { code: "N", label: "N (Abandon)" },
    { code: "H", label: "H (Return ashore)" },
    { code: "X", label: "X (Individual recall)" },
    { code: "S1", label: "1st Substitute (General recall)" },
    { code: "C", label: "C (Change of course)" },
    { code: "M", label: "M (Missing mark)" },
    { code: "Y", label: "Y (Lifejackets mandatory)" },

    // A–Z
    ...("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("") as FlagCode[]).map((c) => ({
      code: c,
      label: c,
    })),

    // Numeral pennants
    ...(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as FlagCode[]).map(
      (c) => ({ code: c, label: `Pennant ${c}` }),
    ),

    // Substitutes
    { code: "S1", label: "1st Substitute" },
    { code: "S2", label: "2nd Substitute" },
    { code: "S3", label: "3rd Substitute" },
  ];

  const seen = new Set<string>();
  const out: { code: FlagCode; label: string }[] = [];
  for (const item of raw) {
    const k = String(item.code);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
})();

export type Flag = {
  id: string;
  // default / inspector value (clips can override what is shown)
  code: FlagCode;
  // position of pole base
  x: number;
  y: number;
};

export type FlagCodeClip = {
  id: string;
  startMs: number;
  endMs: number;
  code: FlagCode;
};

export type FlagClipsByFlagId = Record<string, FlagCodeClip[]>;