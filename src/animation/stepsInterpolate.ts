// stepsInterpolate.ts
import type { Boat, StepsByBoatId, SegmentsByBoatId, Step } from "../types";
import { clamp, lerp } from "../lib/math"; // add clamp01 if you don’t have it

type Vec2 = { x: number; y: number };

function degToRad(d: number) { return (d * Math.PI) / 180; }
function radToDeg(r: number) { return (r * 180) / Math.PI; }

function norm(v: Vec2): Vec2 {
  const m = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / m, y: v.y / m };
}
function sub(a: Vec2, b: Vec2): Vec2 { return { x: a.x - b.x, y: a.y - b.y }; }
function add(a: Vec2, b: Vec2): Vec2 { return { x: a.x + b.x, y: a.y + b.y }; }
function mul(a: Vec2, s: number): Vec2 { return { x: a.x * s, y: a.y * s }; }
function lerpV(a: Vec2, b: Vec2, t: number): Vec2 { return { x: lerp(a.x,b.x,t), y: lerp(a.y,b.y,t) }; }

function headingUnitDeg(deg: number): Vec2 {
  // your convention: 0 = North/up, 90 = East/right
  const r = degToRad(deg);
  return { x: Math.sin(r), y: -Math.cos(r) };
}

function bezierPoint(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const u = 1 - t;
  const tt = t * t, uu = u * u;
  const uuu = uu * u, ttt = tt * t;
  return add(
    add(mul(p0, uuu), mul(p1, 3 * uu * t)),
    add(mul(p2, 3 * u * tt), mul(p3, ttt)),
  );
}

function bezierTangent(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  // derivative of cubic
  const u = 1 - t;
  const a = mul(sub(p1, p0), 3 * u * u);
  const b = mul(sub(p2, p1), 6 * u * t);
  const c = mul(sub(p3, p2), 3 * t * t);
  return add(add(a, b), c);
}

// “subtle influence”: blend chord direction with heading direction
function blendedTangentDir(chord: Vec2, heading: Vec2, w = 0.25): Vec2 {
  return norm(lerpV(norm(chord), norm(heading), w));
}

function effectiveHeadingDeg(steps: Step[], i: number): number {
  const s = steps[i];
  if (s.headingMode === "manual" && typeof s.headingDeg === "number") return s.headingDeg;

  // auto: derive from neighbor direction
  const prev = steps[i - 1];
  const next = steps[i + 1];
  const a = prev ? { x: s.x - prev.x, y: s.y - prev.y } : null;
  const b = next ? { x: next.x - s.x, y: next.y - s.y } : null;

  const v = a && b ? add(norm(a), norm(b)) : (b ? b : (a ? a : { x: 1, y: 0 }));
  const vn = norm(v);
  // convert vector to your headingDeg (0=N)
  const ang = Math.atan2(vn.y, vn.x);          // radians from +x
  const heading = (radToDeg(ang) + 90 + 360) % 360;
  return heading;
}

export function interpolateBoatsAtTimeFromSteps(
  boats: Boat[],
  stepsByBoatId: StepsByBoatId,
  segmentsByBoatId: SegmentsByBoatId,
  tMs: number,
): Boat[] {
  return boats.map((b) => {
    const steps = (stepsByBoatId[b.id] || []).slice().sort((a, c) => a.tMs - c.tMs);
    if (steps.length === 0) return b;
    if (steps.length === 1) return { ...b, x: steps[0].x, y: steps[0].y, headingDeg: effectiveHeadingDeg(steps, 0) };

    // find span
    let i = 0;
    while (i < steps.length && steps[i].tMs <= tMs) i++;
    if (i <= 0) {
      const h = effectiveHeadingDeg(steps, 0);
      return { ...b, x: steps[0].x, y: steps[0].y, headingDeg: h };
    }
    if (i >= steps.length) {
      const h = effectiveHeadingDeg(steps, steps.length - 1);
      const s = steps[steps.length - 1];
      return { ...b, x: s.x, y: s.y, headingDeg: h };
    }

    const a = steps[i - 1];
    const c = steps[i];
    const span = c.tMs - a.tMs;
    const u = span <= 0 ? 0 : clamp((tMs - a.tMs) / span, 0, 1);

    const p0 = { x: a.x, y: a.y };
    const p3 = { x: c.x, y: c.y };

    const chord = sub(p3, p0);
    const dist = Math.hypot(chord.x, chord.y);
    const L = Math.max(10, Math.min(60, dist * 0.2));

    const ha = headingUnitDeg(effectiveHeadingDeg(steps, i - 1));
    const hc = headingUnitDeg(effectiveHeadingDeg(steps, i));

    // manual control point?
    const segs = segmentsByBoatId[b.id] || [];
    const seg = segs[i - 1]; // segment index aligns with [i-1 -> i]
    let p1: Vec2, p2: Vec2;

    if (seg && seg.controlMode === "manual" && seg.controlPoint) {
      const C = seg.controlPoint;
      p1 = lerpV(p0, C, 0.66);
      p2 = lerpV(p3, C, 0.66);
    } else {
      const tan0 = blendedTangentDir(chord, ha, 0.25);
      const tan1 = blendedTangentDir(chord, hc, 0.25);
      p1 = add(p0, mul(tan0, L));
      p2 = sub(p3, mul(tan1, L));
    }

    // Build arc-length table
const table = buildArcLengthTable(p0, p1, p2, p3);

// Get constant-speed position
const pos = pointAtArcLength(table, u);

// For heading, compute small offset forward to estimate tangent
    const eps = 0.001;
    const pos2 = pointAtArcLength(table, clamp(u + eps, 0, 1));
    const tan = sub(pos2, pos);
    const tn = norm(tan);
    const ang = Math.atan2(tn.y, tn.x);
    const headingDeg = (radToDeg(ang) + 90 + 360) % 360;

    return { ...b, x: pos.x, y: pos.y, headingDeg };
  });
}

function buildArcLengthTable(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  samples = 40,
) {
  const pts: Vec2[] = [];
  const dists: number[] = [];

  let total = 0;
  let prev = bezierPoint(p0, p1, p2, p3, 0);
  pts.push(prev);
  dists.push(0);

  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const pt = bezierPoint(p0, p1, p2, p3, t);
    const dx = pt.x - prev.x;
    const dy = pt.y - prev.y;
    total += Math.hypot(dx, dy);

    pts.push(pt);
    dists.push(total);

    prev = pt;
  }

  return { pts, dists, total };
}

function pointAtArcLength(
  table: ReturnType<typeof buildArcLengthTable>,
  fraction: number,
): Vec2 {
  const { pts, dists, total } = table;

  const target = fraction * total;

  for (let i = 1; i < dists.length; i++) {
    if (dists[i] >= target) {
      const segLen = dists[i] - dists[i - 1];
      const localT =
        segLen === 0 ? 0 : (target - dists[i - 1]) / segLen;

      return lerpV(pts[i - 1], pts[i], localT);
    }
  }

  return pts[pts.length - 1];
}