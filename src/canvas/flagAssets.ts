// canvas/flagAssets.ts (or wherever getFlagSvg lives)
import { SIGNAL_FLAGS } from "./signalFlagsData";
import type { FlagCode } from "../types";

type Dataset = typeof SIGNAL_FLAGS;
type SvgRoot = Dataset["svg"];
type StyleKey = keyof SvgRoot;

const DEFAULT_STYLE: StyleKey = "sf-rectangle-no-outline";

function normalizeCode(code: FlagCode): string {
  if (code === "AP") return "ap";
  if (code === "Black") return "black";
  if (code === "S1") return "s1";
  if (code === "S2") return "s2";
  if (code === "S3") return "s3";

  if (/^[A-Z]$/.test(code)) return code.toLowerCase();
  if (/^[0-9]$/.test(code)) return `n${code}`;

  return code.toLowerCase();
}

// ✅ UPDATED: your note says S1/S2/S3 exist in sf-triangle-outline
export function getDefaultFlagStyleFor(code: FlagCode): StyleKey {
  if (code === "S1" || code === "S2" || code === "S3")
    return "sf-triangle-outline";
  if (/^[0-9]$/.test(code)) return "sf-short-no-outline";
  if (/^[A-Z]$/.test(code)) return "sf-rectangle-no-outline";
  return DEFAULT_STYLE;
}

export function getFlagSvg(
  style: StyleKey | undefined,
  code: FlagCode,
): string | null {
  const k = normalizeCode(code);

  // ✅ pick style from code when style is not provided
  const styleKey: StyleKey = style ?? getDefaultFlagStyleFor(code);

  const tryStyle = (s: StyleKey): string | null => {
    const group = SIGNAL_FLAGS.svg[s];
    if (k in group) return group[k as keyof typeof group] ?? null;
    return null;
  };

  // 1) preferred style
  const hit = tryStyle(styleKey);
  if (hit) return hit;

  // 2) numerals fallback sets
  if (k.startsWith("n")) {
    const a = tryStyle("sf-short-no-outline");
    if (a) return a;
    const b = tryStyle("sf-pennant-no-outline");
    if (b) return b;
  }

  // 3) last resort fallbacks across common sets (covers cases like your S1/S2/S3 mismatch)
  const fallbacks: StyleKey[] = [
    "sf-rectangle-no-outline",
    "sf-rectangle-outline",
    "sf-triangle-outline",
    "sf-triangle-no-outline",
    "sf-short-no-outline",
    "sf-pennant-no-outline",
  ];

  for (const s of fallbacks) {
    const v = tryStyle(s);
    if (v) return v;
  }

  return null;
}
