// src/canvas/collision.ts
import type { Boat } from "../types";
import { BOAT_PATH } from "./boat";

export type Point = { x: number; y: number };

type CacheEntry = {
  hullLocal: Point[];
};

const cache = new Map<string, CacheEntry>();

const CURVE_SUBDIVISIONS = 26;
const SLOP = 0.03;
const SOLVER_ITERS = 5;

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}
function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}
function mul(a: Point, s: number): Point {
  return { x: a.x * s, y: a.y * s };
}
function dot(a: Point, b: Point) {
  return a.x * b.x + a.y * b.y;
}
function cross(a: Point, b: Point) {
  return a.x * b.y - a.y * b.x;
}
function normalize(v: Point): Point {
  const len = Math.hypot(v.x, v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

function transformPointLocalToWorld(
  p: Point,
  x: number,
  y: number,
  headingDeg: number,
): Point {
  const a = degToRad(headingDeg);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return {
    x: x + p.x * cos - p.y * sin,
    y: y + p.x * sin + p.y * cos,
  };
}

function transformPolygonLocalToWorld(
  poly: Point[],
  x: number,
  y: number,
  headingDeg: number,
): Point[] {
  return poly.map((p) => transformPointLocalToWorld(p, x, y, headingDeg));
}

/**
 * SVG path flattening (M/m L/l H/h V/v C/c Z/z)
 */
type Cmd =
  | { k: "M"; x: number; y: number }
  | { k: "L"; x: number; y: number }
  | {
      k: "C";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      x: number;
      y: number;
    }
  | { k: "Z" };

function tokenizePath(d: string): string[] {
  const re = /[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g;
  return d.match(re) ?? [];
}

function parsePath(d: string): Cmd[] {
  const t = tokenizePath(d);
  let i = 0;

  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;

  const out: Cmd[] = [];

  function num() {
    const v = t[i++];
    if (v == null) throw new Error("Unexpected end of path");
    return Number(v);
  }

  while (i < t.length) {
    const tok = t[i++];
    if (!tok) break;

    const isRel = tok === tok.toLowerCase();
    const cmd = tok.toUpperCase();

    if (cmd === "M") {
      const x = num();
      const y = num();
      const nx = isRel ? cx + x : x;
      const ny = isRel ? cy + y : y;
      out.push({ k: "M", x: nx, y: ny });
      cx = nx;
      cy = ny;
      sx = nx;
      sy = ny;

      while (i < t.length && !/^[a-zA-Z]$/.test(t[i]!)) {
        const lx = num();
        const ly = num();
        const nnx = isRel ? cx + lx : lx;
        const nny = isRel ? cy + ly : ly;
        out.push({ k: "L", x: nnx, y: nny });
        cx = nnx;
        cy = nny;
      }
      continue;
    }

    if (cmd === "L") {
      while (i < t.length && !/^[a-zA-Z]$/.test(t[i]!)) {
        const x = num();
        const y = num();
        const nx = isRel ? cx + x : x;
        const ny = isRel ? cy + y : y;
        out.push({ k: "L", x: nx, y: ny });
        cx = nx;
        cy = ny;
      }
      continue;
    }

    if (cmd === "H") {
      while (i < t.length && !/^[a-zA-Z]$/.test(t[i]!)) {
        const x = num();
        const nx = isRel ? cx + x : x;
        out.push({ k: "L", x: nx, y: cy });
        cx = nx;
      }
      continue;
    }

    if (cmd === "V") {
      while (i < t.length && !/^[a-zA-Z]$/.test(t[i]!)) {
        const y = num();
        const ny = isRel ? cy + y : y;
        out.push({ k: "L", x: cx, y: ny });
        cy = ny;
      }
      continue;
    }

    if (cmd === "C") {
      while (i < t.length && !/^[a-zA-Z]$/.test(t[i]!)) {
        const x1 = num();
        const y1 = num();
        const x2 = num();
        const y2 = num();
        const x = num();
        const y = num();

        const nx1 = isRel ? cx + x1 : x1;
        const ny1 = isRel ? cy + y1 : y1;
        const nx2 = isRel ? cx + x2 : x2;
        const ny2 = isRel ? cy + y2 : y2;
        const nx = isRel ? cx + x : x;
        const ny = isRel ? cy + y : y;

        out.push({ k: "C", x1: nx1, y1: ny1, x2: nx2, y2: ny2, x: nx, y: ny });
        cx = nx;
        cy = ny;
      }
      continue;
    }

    if (cmd === "Z") {
      out.push({ k: "Z" });
      cx = sx;
      cy = sy;
      continue;
    }
  }

  return out;
}

function cubicAt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

function flattenPathToPoints(d: string, curveSubdivisions: number): Point[] {
  const cmds = parsePath(d);

  let cur: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };
  const pts: Point[] = [];

  const push = (p: Point) => {
    const last = pts[pts.length - 1];
    if (last && Math.hypot(last.x - p.x, last.y - p.y) < 1e-6) return;
    pts.push(p);
  };

  for (const c of cmds) {
    if (c.k === "M") {
      cur = { x: c.x, y: c.y };
      start = { ...cur };
      push(cur);
    } else if (c.k === "L") {
      cur = { x: c.x, y: c.y };
      push(cur);
    } else if (c.k === "C") {
      const p0 = cur;
      const p1 = { x: c.x1, y: c.y1 };
      const p2 = { x: c.x2, y: c.y2 };
      const p3 = { x: c.x, y: c.y };

      for (let i = 1; i <= curveSubdivisions; i++) {
        push(cubicAt(p0, p1, p2, p3, i / curveSubdivisions));
      }
      cur = p3;
    } else if (c.k === "Z") {
      push(start);
    }
  }

  if (pts.length > 2) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < 1e-6) pts.pop();
  }

  return pts;
}

function convexHull(points: Point[]): Point[] {
  if (points.length <= 3) return points.slice();

  const pts = points
    .slice()
    .sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));

  const lower: Point[] = [];
  for (const p of pts) {
    while (lower.length >= 2) {
      const a = lower[lower.length - 2];
      const b = lower[lower.length - 1];
      if (cross(sub(b, a), sub(p, b)) <= 0) lower.pop();
      else break;
    }
    lower.push(p);
  }

  const upper: Point[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2) {
      const a = upper[upper.length - 2];
      const b = upper[upper.length - 1];
      if (cross(sub(b, a), sub(p, b)) <= 0) upper.pop();
      else break;
    }
    upper.push(p);
  }

  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

function getHullLocal(hullPath: string): Point[] {
  const existing = cache.get(hullPath);
  if (existing) return existing.hullLocal;

  const pts = flattenPathToPoints(hullPath, CURVE_SUBDIVISIONS);
  const hull = convexHull(pts);

  cache.set(hullPath, { hullLocal: hull });
  return hull;
}

function getAxes(poly: Point[]): Point[] {
  const axes: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % poly.length];
    const edge = sub(p2, p1);
    axes.push(normalize({ x: -edge.y, y: edge.x }));
  }
  return axes;
}

function project(poly: Point[], axis: Point): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const p of poly) {
    const v = dot(p, axis);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

function intervalOverlap(
  a: { min: number; max: number },
  b: { min: number; max: number },
) {
  return Math.min(a.max, b.max) - Math.max(a.min, b.min);
}

function centroid(poly: Point[]): Point {
  let x = 0,
    y = 0;
  for (const p of poly) {
    x += p.x;
    y += p.y;
  }
  return { x: x / poly.length, y: y / poly.length };
}

type SatResult =
  | { hit: false }
  | { hit: true; depth: number; axis: Point; contact: Point };

function satIntersect(a: Point[], b: Point[]): SatResult {
  const axes = getAxes(a).concat(getAxes(b));

  let minDepth = Infinity;
  let bestAxis: Point | null = null;

  for (const axis0 of axes) {
    const axis = normalize(axis0);
    const pa = project(a, axis);
    const pb = project(b, axis);
    const overlap = intervalOverlap(pa, pb);
    if (overlap <= 0) return { hit: false };

    if (overlap < minDepth) {
      minDepth = overlap;
      bestAxis = axis;
    }
  }

  if (!bestAxis || !isFinite(minDepth)) return { hit: false };

  const ca = centroid(a);
  const cb = centroid(b);
  const dir = sub(cb, ca);
  if (dot(dir, bestAxis) < 0) bestAxis = { x: -bestAxis.x, y: -bestAxis.y };

  const contact = { x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2 };

  return { hit: true, depth: minDepth, axis: bestAxis, contact };
}

function boatPolyWorld(
  boat: Pick<Boat, "x" | "y" | "headingDeg">,
  hullLocal: Point[],
): Point[] {
  return transformPolygonLocalToWorld(
    hullLocal,
    boat.x,
    boat.y,
    boat.headingDeg,
  );
}

function firstCollisionAgainstOthers(
  moving: Pick<Boat, "id" | "x" | "y" | "headingDeg">,
  others: Pick<Boat, "id" | "x" | "y" | "headingDeg">[],
  hullLocal: Point[],
): SatResult & { otherId?: string } {
  const pm = boatPolyWorld(moving, hullLocal);

  for (const o of others) {
    const po = boatPolyWorld(o, hullLocal);
    const r = satIntersect(pm, po);
    if (r.hit) return { ...r, otherId: o.id };
  }
  return { hit: false };
}

export function detectBoatCollisions(
  boats: Boat[],
  opts?: { hullPath?: string },
): {
  collidingBoatIds: Set<string>;
  pairs: Array<[string, string]>;
  contacts: Point[];
} {
  const hullPath = opts?.hullPath ?? BOAT_PATH;
  const hullLocal = getHullLocal(hullPath);

  const collidingBoatIds = new Set<string>();
  const pairs: Array<[string, string]> = [];
  const contacts: Point[] = [];

  for (let i = 0; i < boats.length; i++) {
    for (let j = i + 1; j < boats.length; j++) {
      const a = boats[i];
      const b = boats[j];

      const pa = boatPolyWorld(a, hullLocal);
      const pb = boatPolyWorld(b, hullLocal);

      const r = satIntersect(pa, pb);
      if (r.hit) {
        collidingBoatIds.add(a.id);
        collidingBoatIds.add(b.id);
        pairs.push([a.id, b.id]);
        contacts.push(r.contact);
      }
    }
  }

  return { collidingBoatIds, pairs, contacts };
}

export function resolveBoatCollisionsJustTouching(
  boats: Boat[],
  opts?: { hullPath?: string; iters?: number },
): Boat[] {
  const hullPath = opts?.hullPath ?? BOAT_PATH;
  const hullLocal = getHullLocal(hullPath);
  const iters = opts?.iters ?? SOLVER_ITERS;

  const out: Boat[] = boats.map((b) => ({ ...b }));

  for (let iter = 0; iter < iters; iter++) {
    let any = false;

    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i];
        const b = out[j];

        const pa = boatPolyWorld(a, hullLocal);
        const pb = boatPolyWorld(b, hullLocal);

        const r = satIntersect(pa, pb);
        if (!r.hit) continue;

        const depthToResolve = Math.max(r.depth - SLOP, 0);
        if (depthToResolve <= 0) continue;

        const n = normalize(r.axis);
        const push = mul(n, depthToResolve);

        a.x -= push.x * 0.5;
        a.y -= push.y * 0.5;
        b.x += push.x * 0.5;
        b.y += push.y * 0.5;

        any = true;
      }
    }

    if (!any) break;
  }

  return out;
}

export type DragResolveResult = {
  pos: { x: number; y: number };
  contact: null | {
    otherId: string;
    point: Point;
    normal: Point;
    depth: number;
  };
};

export function resolveDraggedBoatPositionNoOverlap(params: {
  movingBoat: Pick<Boat, "id" | "x" | "y" | "headingDeg">;
  desiredPos: { x: number; y: number };
  otherBoats: Pick<Boat, "id" | "x" | "y" | "headingDeg">[];
  hullPath?: string;
  maxBinarySteps?: number;
}): DragResolveResult {
  const hullPath = params.hullPath ?? BOAT_PATH;
  const hullLocal = getHullLocal(hullPath);
  const maxBinarySteps = params.maxBinarySteps ?? 10;

  const cur = { x: params.movingBoat.x, y: params.movingBoat.y };
  const desired = { x: params.desiredPos.x, y: params.desiredPos.y };
  const delta = sub(desired, cur);

  const deltaLen = Math.hypot(delta.x, delta.y);
  if (deltaLen < 1e-6) return { pos: cur, contact: null };

  const others = params.otherBoats.filter((b) => b.id !== params.movingBoat.id);

  const testAt = (pos: Point) =>
    firstCollisionAgainstOthers(
      { ...params.movingBoat, x: pos.x, y: pos.y },
      others,
      hullLocal,
    );

  // Try desired first
  const hitDesired = testAt(desired);
  const contactFromDesired =
    hitDesired.hit && hitDesired.otherId
      ? {
          otherId: hitDesired.otherId,
          point: hitDesired.contact,
          normal: normalize(hitDesired.axis),
          depth: hitDesired.depth,
        }
      : null;

  if (!hitDesired.hit) {
    return { pos: desired, contact: null };
  }

  // Slide: remove component into the collision normal (keeps motion “along” if possible)
  const n = normalize(hitDesired.axis);
  const into = Math.max(0, dot(delta, n));
  const slideDelta = sub(delta, mul(n, into));

  const slideLen = Math.hypot(slideDelta.x, slideDelta.y);
  if (slideLen > 1e-6) {
    const slidPos = add(cur, slideDelta);
    const hitSlid = testAt(slidPos);
    if (!hitSlid.hit) {
      return { pos: slidPos, contact: contactFromDesired };
    }
  }

  // Binary search along original delta to stop exactly at contact
  const hitCur = testAt(cur);
  if (hitCur.hit) {
    return { pos: cur, contact: contactFromDesired };
  }

  let lo = 0;
  let hi = 1;

  for (let step = 0; step < maxBinarySteps; step++) {
    const mid = (lo + hi) / 2;
    const pos = add(cur, mul(delta, mid));
    const hit = testAt(pos);

    if (!hit.hit) lo = mid;
    else {
      if (hit.depth <= SLOP) lo = mid;
      else hi = mid;
    }
  }

  return { pos: add(cur, mul(delta, lo)), contact: contactFromDesired };
}
