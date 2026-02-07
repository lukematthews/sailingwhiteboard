import type { StartLine } from "../types";

export function drawStartLine(ctx: CanvasRenderingContext2D, line: StartLine) {
  ctx.save();

  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(2,6,23,0.45)";
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(line.committee.x, line.committee.y);
  ctx.lineTo(line.pin.x, line.pin.y);
  ctx.stroke();

  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(2,6,23,0.55)";
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.rect(line.committee.x - 9, line.committee.y - 9, 18, 18);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(line.pin.x, line.pin.y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.font = "12px system-ui";
  ctx.fillStyle = "rgba(15,23,42,0.9)";
  ctx.textAlign = "center";
  ctx.fillText("Committee", line.committee.x, line.committee.y - 16);
  ctx.fillText("Pin", line.pin.x, line.pin.y - 16);

  ctx.restore();
}

export function hitTestStartHandle(px: number, py: number, line: StartLine) {
  const hit = (x: number, y: number) => {
    const dx = px - x;
    const dy = py - y;
    return dx * dx + dy * dy <= 16 * 16;
  };

  if (hit(line.committee.x, line.committee.y)) return "committee" as const;
  if (hit(line.pin.x, line.pin.y)) return "pin" as const;
  return null;
}
