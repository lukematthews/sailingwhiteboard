// src/canvas/grid.ts
import type { Camera } from "../builder/camera";

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  camera: Camera,
) {
  const { x, y, zoom } = camera;

  // Visible world bounds
  const worldLeft = -x / zoom;
  const worldTop = -y / zoom;
  const worldRight = worldLeft + canvasWidth / zoom;
  const worldBottom = worldTop + canvasHeight / zoom;

  // Base grid spacing in world units
  const baseSpacing = 50;

  // Optional: scale spacing so grid doesn’t get too dense when zoomed out
  let spacing = baseSpacing;
  if (zoom < 0.5) spacing = 100;
  if (zoom < 0.25) spacing = 200;

  const startX = Math.floor(worldLeft / spacing) * spacing;
  const endX = Math.ceil(worldRight / spacing) * spacing;

  const startY = Math.floor(worldTop / spacing) * spacing;
  const endY = Math.ceil(worldBottom / spacing) * spacing;

  ctx.save();
  ctx.lineWidth = 1 / zoom;
  ctx.strokeStyle = "rgba(0,0,0,0.08)";

  // Vertical lines
  for (let x = startX; x <= endX; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, worldTop);
    ctx.lineTo(x, worldBottom);
    ctx.stroke();
  }

  // Horizontal lines
  for (let y = startY; y <= endY; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(worldLeft, y);
    ctx.lineTo(worldRight, y);
    ctx.stroke();
  }

  ctx.restore();
}
