import type { Boat } from "../types";
import { drawTransomOverlapLineLocal } from "./transomOverlap";

export const BOAT_PATH =
  "m -9,50 h 18 c 5,-22 11,-50 -9,-90 -20,40 -14,68 -9,90 z";
export const MAINSAIL_PATH = "m 0 0 l 0 47.5 c -4 36, -16 12, 0 0 z";

export type BoatDrawOptions = {
  /** Optional dashed line across the transom plane to help indicate overlaps. */
  showTransomOverlap?: boolean;

  /** Length of the overlap line in local boat pixels (canvas px). */
  transomLineLengthPx?: number;

  /** Move the line aft behind the transom (positive y in local boat coords). */
  transomLineOffsetAftPx?: number;

  /** Dash pattern for the overlap line. */
  transomLineDash?: number[];
};

export function drawBoat(
  ctx: CanvasRenderingContext2D,
  boat: Boat,
  opts: BoatDrawOptions = {},
) {
  const { x, y, headingDeg, color, label } = boat;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((headingDeg * Math.PI) / 180);

  const hull = new Path2D(BOAT_PATH);

  ctx.fillStyle = color;
  ctx.fill(hull);

  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.stroke(hull);

  // ✅ Draw in LOCAL coords (ctx already translated+rotated)
  // BOAT_PATH stern is at y=50 in local boat space.
  drawTransomOverlapLineLocal(ctx, {
    enabled: opts.showTransomOverlap ?? false,
    sternY: 46,
    lineLengthPx: opts.transomLineLengthPx ?? 128,
    offsetAftPx: opts.transomLineOffsetAftPx ?? 6,
    dash: opts.transomLineDash ?? [6, 6],
  });

  if (label) {
    // rotate back so text is upright
    ctx.rotate(-(headingDeg * Math.PI) / 180);
    ctx.font = "12px system-ui";
    ctx.fillStyle = "#111";
    ctx.textAlign = "center";
    ctx.fillText(label, 0, -50);
  }

  ctx.restore();
}

/**
 * Draw only an outline of the hull — used for collision emphasis etc.
 * Uses the same BOAT_PATH as the filled hull, so it matches exactly.
 */
export function drawBoatOutline(
  ctx: CanvasRenderingContext2D,
  boat: Pick<Boat, "x" | "y" | "headingDeg">,
  style: { strokeStyle: string; lineWidth?: number; dash?: number[] },
) {
  ctx.save();
  ctx.translate(boat.x, boat.y);
  ctx.rotate((boat.headingDeg * Math.PI) / 180);

  const hull = new Path2D(BOAT_PATH);

  ctx.strokeStyle = style.strokeStyle;
  ctx.lineWidth = style.lineWidth ?? 3;
  if (style.dash && style.dash.length) ctx.setLineDash(style.dash);
  ctx.stroke(hull);

  ctx.restore();
}
