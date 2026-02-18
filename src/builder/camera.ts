export type Camera = {
  x: number;     // translation in CSS px
  y: number;
  zoom: number;  // 1 = 100%
};

export function screenToWorld(
  p: { x: number; y: number },
  cam: Camera,
) {
  return {
    x: (p.x - cam.x) / cam.zoom,
    y: (p.y - cam.y) / cam.zoom,
  };
}

export function worldToScreen(
  p: { x: number; y: number },
  cam: Camera,
) {
  return {
    x: p.x * cam.zoom + cam.x,
    y: p.y * cam.zoom + cam.y,
  };
}