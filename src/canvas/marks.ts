import type { Mark } from "../types";

export function drawMark(ctx: CanvasRenderingContext2D, m: Mark) {
  ctx.save();
  ctx.translate(m.x, m.y);

  const r = 10;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle =
    m.color ||
    (m.type === "start"
      ? "#10b981"
      : m.type === "finish"
        ? "#ef4444"
        : "#111827");
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.stroke();

  ctx.font = "12px system-ui";
  ctx.fillStyle = "rgba(15,23,42,0.95)";
  ctx.textAlign = "center";
  ctx.fillText(m.name, 0, -16);

  ctx.restore();
}

export function hitTestMark(px: number, py: number, m: Mark) {
  const dx = px - m.x;
  const dy = py - m.y;
  return dx * dx + dy * dy <= 14 * 14;
}
