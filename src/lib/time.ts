import { clamp } from "./math";

export function formatTime(ms: number) {
  const s = ms / 1000;
  return `${s.toFixed(2)}s`;
}

export function snapTime(tMs: number, fps: number) {
  const frame = 1000 / fps;
  return Math.round(tMs / frame) * frame;
}

export function xToMs(x: number, durationMs: number, width: number) {
  return clamp((x / width) * durationMs, 0, durationMs);
}

export function msToX(tMs: number, durationMs: number, width: number) {
  return (tMs / durationMs) * width;
}