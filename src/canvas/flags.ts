// canvas/flags.ts
// Flag rendering + hit testing + timeline resolution (Option A: each flag has its own lane)

import type { Flag, FlagCode, FlagCodeClip, FlagClipsByFlagId } from "../types";
import { getFlagSvg } from "./flagAssets";

// --- geometry ---
const FLAG_W = 48;
const FLAG_H = 32;

// --- helpers ---
export function resolveActiveFlagCode(
  flag: Flag,
  clips: FlagClipsByFlagId[string] | undefined,
  timeMs: number,
): FlagCode | null {
  // Option A:
  // - If clips exist -> resolve by time
  // - If no clips -> always visible using flag.code
  if (!clips || clips.length === 0) return flag.code ?? null;

  const hit = clips.find((c: FlagCodeClip) => timeMs >= c.startMs && timeMs <= c.endMs);
  return hit ? hit.code : null;
}

// --- SVG normalization ---
// Many browsers will treat data: SVG images as "broken" unless the root <svg> has an xmlns.
function ensureSvgXmlns(svg: string): string {
  if (svg.includes('xmlns="http://www.w3.org/2000/svg"')) return svg;

  // Add xmlns on the root <svg ...> tag.
  // Works for strings like "<svg viewBox="...">"
  return svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
}

function toSvgDataUrl(svg: string): string {
  const normalized = ensureSvgXmlns(svg);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(normalized)}`;
}

// --- image cache (prevents reloading every frame) ---
type CacheEntry = {
  img: HTMLImageElement;
  status: "loading" | "ready" | "error";
};

const IMG_CACHE = new Map<string, CacheEntry>();

function getCachedSvgImage(svg: string): CacheEntry {
  // Normalize first so:
  // 1) browser loads reliably
  // 2) cache key is stable for equivalent svgs
  const normalized = ensureSvgXmlns(svg);
  const key = normalized;

  const cached = IMG_CACHE.get(key);
  if (cached) return cached;

  const img = new Image();
  const entry: CacheEntry = { img, status: "loading" };

  img.onload = () => {
    entry.status = "ready";
    window.dispatchEvent(new Event("flagassetloaded"));
  };

  img.onerror = () => {
    entry.status = "error";
    // still trigger a redraw so we can render a placeholder instead of nothing
    window.dispatchEvent(new Event("flagassetloaded"));
  };

  img.src = toSvgDataUrl(normalized);

  IMG_CACHE.set(key, entry);
  return entry;
}

// --- draw ---
export function drawFlag(
  ctx: CanvasRenderingContext2D,
  flag: Flag,
  code: FlagCode,
  selected: boolean,
) {
  const svg = getFlagSvg(undefined, code);

  // If svg lookup failed, draw a placeholder so you *see something*
  if (!svg) {
    drawPlaceholder(ctx, flag, code, selected);
    return;
  }

  const entry = getCachedSvgImage(svg);

  // if loading, skip this frame (onload/onerror will trigger a redraw)
  if (entry.status === "loading") return;

  // if error, draw placeholder (don’t disappear silently)
  if (entry.status === "error") {
    drawPlaceholder(ctx, flag, code, selected);
    return;
  }

  // status === "ready"
  const img = entry.img;

  // extra guard: some browsers can still report ready-but-broken; don't crash draw loop
  if (!img.complete || img.naturalWidth === 0) {
    drawPlaceholder(ctx, flag, code, selected);
    return;
  }

  ctx.save();
  ctx.translate(flag.x, flag.y);

  ctx.drawImage(img, -FLAG_W / 2, -FLAG_H / 2, FLAG_W, FLAG_H);

  if (selected) {
    ctx.strokeStyle = "rgba(37,99,235,0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(-FLAG_W / 2 - 3, -FLAG_H / 2 - 3, FLAG_W + 6, FLAG_H + 6);
  }

  ctx.restore();
}

function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  flag: Flag,
  code: FlagCode,
  selected: boolean,
) {
  ctx.save();
  ctx.translate(flag.x, flag.y);

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.strokeStyle = selected ? "rgba(37,99,235,0.9)" : "rgba(0,0,0,0.25)";
  ctx.lineWidth = selected ? 2 : 1;

  ctx.fillRect(-FLAG_W / 2, -FLAG_H / 2, FLAG_W, FLAG_H);
  ctx.strokeRect(-FLAG_W / 2, -FLAG_H / 2, FLAG_W, FLAG_H);

  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.font = "11px ui-sans-serif, system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(code), 0, 0);

  ctx.restore();
}

// --- hit test ---
export function hitTestFlag(px: number, py: number, flag: Flag): boolean {
  return (
    px >= flag.x - FLAG_W / 2 &&
    px <= flag.x + FLAG_W / 2 &&
    py >= flag.y - FLAG_H / 2 &&
    py <= flag.y + FLAG_H / 2
  );
}