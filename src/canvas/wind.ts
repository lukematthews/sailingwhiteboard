import type { Wind } from "../types";
import { degToRad } from "../lib/math";

export function drawWind(
  ctx: CanvasRenderingContext2D,
  w: Wind,
  anchor: { x: number; y: number },
) {
  // arrow points TOWARD where wind is going (fromDeg + 180)
  const toDeg = (w.fromDeg + 180) % 360;

  ctx.save();
  ctx.translate(anchor.x, anchor.y);
  ctx.rotate(degToRad(toDeg));

  const L = 70;
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(2,6,23,0.55)";
  ctx.fillStyle = "rgba(2,6,23,0.55)";

  ctx.beginPath();
  ctx.moveTo(0, -L / 2);
  ctx.lineTo(0, L / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, -L / 2 - 14);
  ctx.lineTo(-10, -L / 2 + 4);
  ctx.lineTo(10, -L / 2 + 4);
  ctx.closePath();
  ctx.fill();

  ctx.rotate(-degToRad(toDeg));
  ctx.font = "12px system-ui";
  ctx.fillStyle = "rgba(2,6,23,0.75)";
  ctx.textAlign = "left";
  ctx.fillText(
    `Wind ${Math.round(w.fromDeg)}°${w.speedKt ? ` @ ${w.speedKt}kt` : ""}`,
    16,
    5,
  );

  ctx.restore();
}
