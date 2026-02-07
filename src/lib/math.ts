export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function degToRad(d: number) {
  return (d * Math.PI) / 180;
}

export function radToDeg(r: number) {
  return (r * 180) / Math.PI;
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function lerpAngle(a: number, b: number, t: number) {
  const delta = ((b - a + 540) % 360) - 180;
  return a + delta * t;
}

export function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}