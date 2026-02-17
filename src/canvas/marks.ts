import type { Mark } from "../types";

export type MarkDrawOptions = {
  showThreeBoatLengthCircle?: boolean;

  /** Boat length in canvas pixels (tune this to your boat scale). */
  boatLengthPx?: number;
};

export function drawMark(
  ctx: CanvasRenderingContext2D,
  m: Mark,
  opts: MarkDrawOptions = {},
) {
  // ------------------------------------------------------------
  // Mark geometry
  // ------------------------------------------------------------
  const r = 12; // mark radius (must match hitTestMark)

  const { showThreeBoatLengthCircle = false, boatLengthPx = 90 } = opts;

  // ------------------------------------------------------------
  // ✅ 3BL circle measured from OUTSIDE of mark
  // ------------------------------------------------------------
  if (showThreeBoatLengthCircle) {
    const radius3BL = boatLengthPx * 3 + r;

    ctx.save();
    ctx.beginPath();
    ctx.arc(m.x, m.y, radius3BL, 0, Math.PI * 2);

    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(2,6,23,0.22)";
    ctx.stroke();

    ctx.restore();
  }

  // ------------------------------------------------------------
  // Mark body
  // ------------------------------------------------------------
  ctx.save();

  ctx.beginPath();
  ctx.arc(m.x, m.y, r, 0, Math.PI * 2);

  ctx.fillStyle = "#fff";
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.stroke();

  // ------------------------------------------------------------
  // Label
  // ------------------------------------------------------------
  ctx.font = "12px system-ui";
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.textAlign = "center";
  ctx.fillText(m.name ?? "Mark", m.x, m.y - 18);

  ctx.restore();
}

export function hitTestMark(px: number, py: number, m: Mark) {
  const r = 12;
  const dx = px - m.x;
  const dy = py - m.y;
  return dx * dx + dy * dy <= r * r;
}
