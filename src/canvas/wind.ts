import { Wind } from "../types";

export function drawWind(
  ctx: CanvasRenderingContext2D,
  w: Wind,
  anchor: { x: number; y: number },
) {
  ctx.save();
  ctx.translate(anchor.x, anchor.y);

  const shaftWidth = 20;
  const shaftHeight = 40;
  const headWidth = 50;
  const headHeight = 30;

  ctx.beginPath();

  // Top left of shaft
  ctx.moveTo(-shaftWidth / 2, -shaftHeight);

  // Top right of shaft
  ctx.lineTo(shaftWidth / 2, -shaftHeight);

  // Down right side of shaft
  ctx.lineTo(shaftWidth / 2, 0);

  // Right edge of arrow head
  ctx.lineTo(headWidth / 2, 0);

  // Tip
  ctx.lineTo(0, headHeight);

  // Left edge of arrow head
  ctx.lineTo(-headWidth / 2, 0);

  // Up left side of shaft
  ctx.lineTo(-shaftWidth / 2, 0);

  ctx.closePath();

  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(2,6,23,0.85)";
  ctx.stroke();

  // ---- Label ----
  ctx.font = "12px system-ui";
  ctx.fillStyle = "rgba(2,6,23,0.75)";
  ctx.textAlign = "left";

  ctx.fillText(
    `Wind ${Math.round(w.fromDeg)}°${w.speedKt ? ` @ ${w.speedKt}kt` : ""}`,
    40,
    -10,
  );

  ctx.restore();
}
