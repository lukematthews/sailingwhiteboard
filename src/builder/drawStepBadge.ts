function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

export function drawStepBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
) {
  ctx.save();
  ctx.font = "11px ui-sans-serif, system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const padX = 6;
  const h = 16;
  const w = Math.max(16, ctx.measureText(text).width + padX * 2);

  roundRectPath(ctx, x - w / 2, y - h / 2, w, h, 7);
  ctx.fillStyle = "rgba(15, 23, 42, 0.65)";
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}