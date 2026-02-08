import type { Boat } from "../types";

export const BOAT_PATH =
  "m -9,50 h 18 c 5,-22 11,-50 -9,-90 -20,40 -14,68 -9,90 z";

export function drawBoat(ctx: CanvasRenderingContext2D, boat: Boat) {
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

  ctx.beginPath();
  ctx.moveTo(0, -58);
  ctx.lineTo(0, 28);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.stroke();

  if (label) {
    ctx.rotate(-(headingDeg * Math.PI) / 180);
    ctx.font = "12px system-ui";
    ctx.fillStyle = "#111";
    ctx.textAlign = "center";
    ctx.fillText(label, 0, -72);
  }

  ctx.restore();
}
