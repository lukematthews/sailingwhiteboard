import type {
  Step,
  Segment,
  StepsByBoatId,
  SegmentsByBoatId,
  Vec2,
} from "../types";

// returns an array of polylines; one polyline per segment (or flatten if you prefer)
export function sampleBoatStepPath(
  steps: Step[],
  segs: Segment[],
  samplesPerSegment = 24,
): Vec2[] {
  // implement by reusing your bezier P0..P3 logic and calling bezierPoint at t=0..1
  // return a flattened Vec2[] for drawing
  return [];
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function norm(x: number, y: number) {
  const m = Math.hypot(x, y) || 1;
  return { x: x / m, y: y / m };
}
function headingUnitDeg(deg: number) {
  const r = (deg * Math.PI) / 180;
  return { x: Math.sin(r), y: -Math.cos(r) };
}
function lerpV(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}
function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}
function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}
function mul(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, y: a.y * s };
}

function bezierPoint(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const u = 1 - t;
  const tt = t * t,
    uu = u * u;
  const uuu = uu * u,
    ttt = tt * t;
  return add(
    add(mul(p0, uuu), mul(p1, 3 * uu * t)),
    add(mul(p2, 3 * u * tt), mul(p3, ttt)),
  );
}

function effectiveHeadingDeg(steps: Step[], i: number): number {
  const s = steps[i];
  if (s.headingMode === "manual" && typeof s.headingDeg === "number")
    return s.headingDeg;

  const prev = steps[i - 1];
  const next = steps[i + 1];
  const a = prev ? { x: s.x - prev.x, y: s.y - prev.y } : null;
  const b = next ? { x: next.x - s.x, y: next.y - s.y } : null;

  const v =
    a && b
      ? add(norm(a.x, a.y), norm(b.x, b.y))
      : b
        ? b
        : a
          ? a
          : { x: 1, y: 0 };
  const vn = norm(v.x, v.y);

  const ang = Math.atan2(vn.y, vn.x);
  return ((ang * 180) / Math.PI + 90 + 360) % 360;
}

function blendedTangentDir(chord: Vec2, heading: Vec2, w = 0.25): Vec2 {
  const d = norm(chord.x, chord.y);
  const h = norm(heading.x, heading.y);
  return norm(lerp(d.x, h.x, w), lerp(d.y, h.y, w));
}

export function sampleStepsPath(
  stepsIn: Step[],
  segs: Segment[],
  samplesPerSegment = 24,
): Vec2[] {
  const steps = stepsIn.slice().sort((a, b) => a.tMs - b.tMs);
  if (steps.length < 2) return [];

  const out: Vec2[] = [];

  for (let i = 1; i < steps.length; i++) {
    const a = steps[i - 1];
    const b = steps[i];

    const p0 = { x: a.x, y: a.y };
    const p3 = { x: b.x, y: b.y };
    const chord = sub(p3, p0);
    const dist = Math.hypot(chord.x, chord.y);
    const L = clamp(dist * 0.2, 10, 60);

    const ha = headingUnitDeg(effectiveHeadingDeg(steps, i - 1));
    const hb = headingUnitDeg(effectiveHeadingDeg(steps, i));

    const seg = segs[i - 1]; // optional alignment for now
    let p1: Vec2, p2: Vec2;

    if (seg && seg.controlMode === "manual" && seg.controlPoint) {
      const C = seg.controlPoint;
      p1 = lerpV(p0, C, 0.66);
      p2 = lerpV(p3, C, 0.66);
    } else {
      const tan0 = blendedTangentDir(chord, ha, 0.25);
      const tan1 = blendedTangentDir(chord, hb, 0.25);
      p1 = add(p0, mul(tan0, L));
      p2 = sub(p3, mul(tan1, L));
    }

    for (let k = 0; k <= samplesPerSegment; k++) {
      const t = k / samplesPerSegment;
      const pt = bezierPoint(p0, p1, p2, p3, t);
      // avoid duplicating points at joins
      if (out.length && k === 0) continue;
      out.push(pt);
    }
  }

  return out;
}
