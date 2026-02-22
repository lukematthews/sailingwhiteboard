// src/canvas/drawStar.ts
export function drawImpactStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  opts?: { outerR?: number; innerR?: number; points?: number },
) {
  const outerR = opts?.outerR ?? 10;
  const innerR = opts?.innerR ?? 5;
  const points = opts?.points ?? 5;

  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();

  const step = Math.PI / points;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = -Math.PI / 2 + i * step;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }

  ctx.closePath();
  ctx.fillStyle = "rgba(220,38,38,0.95)";
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(127,29,29,0.9)";
  ctx.stroke();

  ctx.restore();
}
