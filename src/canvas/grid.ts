export function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  const minor = 25;
  const major = 100;

  for (let x = 0; x <= w; x += minor) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.strokeStyle = x % major === 0 ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.06)";
    ctx.lineWidth = x % major === 0 ? 1.5 : 1;
    ctx.stroke();
  }

  for (let y = 0; y <= h; y += minor) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.strokeStyle = y % major === 0 ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.06)";
    ctx.lineWidth = y % major === 0 ? 1.5 : 1;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(w / 2 - 10, h / 2);
  ctx.lineTo(w / 2 + 10, h / 2);
  ctx.moveTo(w / 2, h / 2 - 10);
  ctx.lineTo(w / 2, h / 2 + 10);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}
