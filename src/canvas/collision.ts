// src/canvas/collision.ts
import type { Boat } from "../types";
import { BOAT_PATH } from "./boat";

export type Point = { x: number; y: number };

type Triangle = [Point, Point, Point];

type CacheEntry = {
  // local-space polygon (flattened)
  poly: Point[];
  // local-space triangles (ear clipped)
  tris: Triangle[];
};

const shapeCache = new Map<string, CacheEntry>();

// Tune: higher = more faithful to curved hull. 16–28 is a good range.
const CURVE_SUBDIVISIONS = 22;

/**
 * Convert degrees to radians.
 */
function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/**
 * Transform a point from local boat space into world space.
 * Assumes 0° = up (negative y), positive rotation = clockwise,
 * which matches your canvas rotation convention.
 */
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

function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function dot(a: Point, b: Point) {
  return a.x * b.x + a.y * b.y;
}

function cross(a: Point, b: Point) {
  return a.x * b.y - a.y * b.x;
}

function dist2(a: Point, b: Point) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * ===== SVG PATH FLATTENING =====
 * Supports M/m, L/l, H/h, V/v, C/c, Z/z. That covers your BOAT_PATH.
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

function tokenizePath(d: string): Array<string> {
  // Split by command letters and numbers (including negatives and decimals).
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

      // Subsequent pairs are treated as implicit L
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

    // Unknown command — ignore safely
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

/**
 * Flatten path to a polygon. Assumes the path is a single closed loop.
 * Removes near-duplicate points.
 */
function flattenPathToPolygon(d: string, curveSubdivisions: number): Point[] {
  const cmds = parsePath(d);

  let cur: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };

  const pts: Point[] = [];

  const push = (p: Point) => {
    const last = pts[pts.length - 1];
    if (last && dist2(last, p) < 0.0001) return;
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
        const t = i / curveSubdivisions;
        push(cubicAt(p0, p1, p2, p3, t));
      }
      cur = p3;
    } else if (c.k === "Z") {
      push(start);
    }
  }

  // Ensure closed and remove final duplicate of first point
  if (pts.length > 2) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (dist2(first, last) < 0.0001) pts.pop();
  }

  return pts;
}

/**
 * Ensure polygon is CCW (needed for ear clipping).
 */
function polygonArea(poly: Point[]) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function ensureCCW(poly: Point[]) {
  if (polygonArea(poly) < 0) poly.reverse();
}

/**
 * Point in triangle (barycentric sign method).
 */
function pointInTri(p: Point, a: Point, b: Point, c: Point) {
  const v0 = sub(c, a);
  const v1 = sub(b, a);
  const v2 = sub(p, a);

  const dot00 = dot(v0, v0);
  const dot01 = dot(v0, v1);
  const dot02 = dot(v0, v2);
  const dot11 = dot(v1, v1);
  const dot12 = dot(v1, v2);

  const denom = dot00 * dot11 - dot01 * dot01;
  if (denom === 0) return false;
  const inv = 1 / denom;

  const u = (dot11 * dot02 - dot01 * dot12) * inv;
  const v = (dot00 * dot12 - dot01 * dot02) * inv;

  return u >= 0 && v >= 0 && u + v <= 1;
}

/**
 * Ear clipping triangulation for simple polygons.
 * Works for convex and mild concave shapes.
 */
function triangulateEarClip(polyIn: Point[]): Triangle[] {
  const poly = polyIn.slice();
  ensureCCW(poly);

  const tris: Triangle[] = [];
  const idx = poly.map((_, i) => i);

  const isConvex = (prev: Point, cur: Point, next: Point) => {
    const a = sub(cur, prev);
    const b = sub(next, cur);
    return cross(a, b) > 0;
  };

  const maxIter = 10000;
  let iter = 0;

  while (idx.length >= 3 && iter++ < maxIter) {
    let earFound = false;

    for (let i = 0; i < idx.length; i++) {
      const iPrev = idx[(i - 1 + idx.length) % idx.length];
      const iCur = idx[i];
      const iNext = idx[(i + 1) % idx.length];

      const pPrev = poly[iPrev];
      const pCur = poly[iCur];
      const pNext = poly[iNext];

      if (!isConvex(pPrev, pCur, pNext)) continue;

      // Check no other point inside ear
      let hasInside = false;
      for (let j = 0; j < idx.length; j++) {
        const ij = idx[j];
        if (ij === iPrev || ij === iCur || ij === iNext) continue;
        if (pointInTri(poly[ij], pPrev, pCur, pNext)) {
          hasInside = true;
          break;
        }
      }
      if (hasInside) continue;

      tris.push([pPrev, pCur, pNext]);
      idx.splice(i, 1);
      earFound = true;
      break;
    }

    if (!earFound) {
      // fallback: stop to avoid infinite loop
      break;
    }
  }

  return tris;
}

/**
 * Segment intersection for triangle edges.
 */
function segIntersect(
  a1: Point,
  a2: Point,
  b1: Point,
  b2: Point,
): Point | null {
  const r = sub(a2, a1);
  const s = sub(b2, b1);
  const rxs = cross(r, s);
  const qpxr = cross(sub(b1, a1), r);

  if (rxs === 0 && qpxr === 0) return null; // collinear
  if (rxs === 0 && qpxr !== 0) return null; // parallel

  const t = cross(sub(b1, a1), s) / rxs;
  const u = cross(sub(b1, a1), r) / rxs;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return { x: a1.x + t * r.x, y: a1.y + t * r.y };
  }
  return null;
}

function triContainsPoint(tri: Triangle, p: Point) {
  return pointInTri(p, tri[0], tri[1], tri[2]);
}

/**
 * Triangle-triangle intersection test + returns an approximate contact point.
 */
function trianglesIntersect(
  t1: Triangle,
  t2: Triangle,
): { hit: boolean; contact?: Point } {
  // 1) Any vertex of t1 in t2?
  for (const p of t1) {
    if (triContainsPoint(t2, p)) return { hit: true, contact: p };
  }
  // 2) Any vertex of t2 in t1?
  for (const p of t2) {
    if (triContainsPoint(t1, p)) return { hit: true, contact: p };
  }
  // 3) Any edge intersects?
  const e1: Array<[Point, Point]> = [
    [t1[0], t1[1]],
    [t1[1], t1[2]],
    [t1[2], t1[0]],
  ];
  const e2: Array<[Point, Point]> = [
    [t2[0], t2[1]],
    [t2[1], t2[2]],
    [t2[2], t2[0]],
  ];
  for (const [a1, a2] of e1) {
    for (const [b1, b2] of e2) {
      const p = segIntersect(a1, a2, b1, b2);
      if (p) return { hit: true, contact: p };
    }
  }
  return { hit: false };
}

function getShape(path: string): CacheEntry {
  const cached = shapeCache.get(path);
  if (cached) return cached;

  const poly = flattenPathToPolygon(path, CURVE_SUBDIVISIONS);

  // If the source path isn’t explicitly closed, ensure it is
  if (poly.length >= 3) ensureCCW(poly);

  const tris = triangulateEarClip(poly);

  const entry: CacheEntry = { poly, tris };
  shapeCache.set(path, entry);
  return entry;
}

function transformTriLocalToWorld(
  tri: Triangle,
  x: number,
  y: number,
  headingDeg: number,
): Triangle {
  return [
    transformPointLocalToWorld(tri[0], x, y, headingDeg),
    transformPointLocalToWorld(tri[1], x, y, headingDeg),
    transformPointLocalToWorld(tri[2], x, y, headingDeg),
  ];
}

export type CollisionResult = {
  collidingBoatIds: Set<string>;
  pairs: Array<[string, string]>;
  contacts: Point[]; // approximate contact points for markers
};

/**
 * Detect hull contact using the real BOAT_PATH geometry (flattened + triangulated).
 * Future boat shapes can be supported by passing a different path string.
 */
export function detectBoatCollisions(
  boats: Boat[],
  opts?: { hullPath?: string },
): CollisionResult {
  const hullPath = opts?.hullPath ?? BOAT_PATH;
  const { tris } = getShape(hullPath);

  const collidingBoatIds = new Set<string>();
  const pairs: Array<[string, string]> = [];
  const contacts: Point[] = [];

  // Precompute transformed triangles per boat
  const trisByBoatId = new Map<string, Triangle[]>();
  for (const b of boats) {
    trisByBoatId.set(
      b.id,
      tris.map((t) => transformTriLocalToWorld(t, b.x, b.y, b.headingDeg)),
    );
  }

  for (let i = 0; i < boats.length; i++) {
    for (let j = i + 1; j < boats.length; j++) {
      const a = boats[i];
      const b = boats[j];

      const ta = trisByBoatId.get(a.id)!;
      const tb = trisByBoatId.get(b.id)!;

      let hit = false;
      for (const t1 of ta) {
        for (const t2 of tb) {
          const r = trianglesIntersect(t1, t2);
          if (r.hit) {
            hit = true;
            if (r.contact) contacts.push(r.contact);
            break;
          }
        }
        if (hit) break;
      }

      if (hit) {
        collidingBoatIds.add(a.id);
        collidingBoatIds.add(b.id);
        pairs.push([a.id, b.id]);
      }
    }
  }

  return { collidingBoatIds, pairs, contacts };
}
