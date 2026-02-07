import type { Boat } from "../types";

export const BOAT_PATH =
  "M -9,30 H 9 C 13.868315,7.9907994 20.032202,-19.390455 0,-60 C -20.032202,-19.390455 -13.868315,7.9907994 -9,30 Z";

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
