export type TransomOverlapOptions = {
  enabled?: boolean;

  /** Total length of the overlap line (in canvas px, same space as BOAT_PATH drawing). */
  lineLengthPx?: number;

  /** Where the stern is in local boat coords (BOAT_PATH has stern at y=50). */
  sternY?: number;

  /** Push the line further aft (positive y) so it sits behind the transom. */
  offsetAftPx?: number;

  /** Dash pattern, e.g. [6,6]. */
  dash?: number[];

  lineWidth?: number;
  strokeStyle?: string;
};

/**
 * Draws a short dashed segment representing the transom plane / overlap indicator.
 * IMPORTANT: expects ctx to already be in boat-local space (translated & rotated).
 */
export function drawTransomOverlapLineLocal(
  ctx: CanvasRenderingContext2D,
  opts: TransomOverlapOptions = {},
) {
  const {
    enabled = false,
    lineLengthPx = 34,
    sternY = 50,
    offsetAftPx = 6,
    dash = [6, 6],
    lineWidth = 2,
    strokeStyle = "rgba(2,6,23,0.22)",
  } = opts;

  if (!enabled) return;

  const half = lineLengthPx / 2;
  const y = sternY + offsetAftPx;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-half, y);
  ctx.lineTo(half, y);

  ctx.setLineDash(dash);
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = strokeStyle;
  ctx.stroke();
  ctx.restore();
}
