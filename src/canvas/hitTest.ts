import { degToRad } from "../lib/math";
import type { Boat } from "../types";

export function hitTestBoat(px: number, py: number, boat: Boat) {
  const dx = px - boat.x;
  const dy = py - boat.y;
  const ang = -degToRad(boat.headingDeg);
  const rx = dx * Math.cos(ang) - dy * Math.sin(ang);
  const ry = dx * Math.sin(ang) + dy * Math.cos(ang);

  const a = 14;
  const b = 30;
  return (rx * rx) / (a * a) + (ry * ry) / (b * b) <= 1.15;
}
