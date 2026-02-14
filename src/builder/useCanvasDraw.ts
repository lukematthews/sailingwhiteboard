import { useEffect } from "react";
import { formatTime, snapTime } from "../lib/time";
import { drawBoat } from "../canvas/boat";
import { drawGrid } from "../canvas/grid";
import { drawMark } from "../canvas/marks";
import { drawWind } from "../canvas/wind";
import { drawStartLine } from "../canvas/startLine";
import { drawFlag, resolveActiveFlagCode } from "../canvas/flags";
import { sampleStepsPath } from "../animation/stepsPath";
import { interpolateBoatsAtTimeFromSteps } from "../animation/stepsInterpolate";
import type {
  Boat,
  Flag,
  FlagClipsByFlagId,
  Mark,
  SegmentsByBoatId,
  StartLine,
  StepsByBoatId,
  Wind,
} from "../types";
import { findClosestStepIndex, frameStepMs, sortSteps } from "./utilSteps";
import { drawStepBadge } from "./drawStepBadge";

export function useCanvasDraw(args: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  boats: Boat[];
  displayedBoats: Boat[];
  stepsByBoatId: StepsByBoatId;
  segmentsByBoatId: SegmentsByBoatId;
  timeMs: number;
  durationMs: number;
  fps: number;
  selectedBoatId: string | null;
  marks: Mark[];
  wind: Wind;
  startLine: StartLine;
  flags: Flag[];
  flagClipsByFlagId: FlagClipsByFlagId;
  selectedFlagId: string | null;
  assetTick: number;
}) {
  const {
    canvasRef,
    boats,
    displayedBoats,
    stepsByBoatId,
    segmentsByBoatId,
    timeMs,
    durationMs,
    fps,
    selectedBoatId,
    marks,
    wind,
    startLine,
    flags,
    flagClipsByFlagId,
    selectedFlagId,
    assetTick,
  } = args;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const w = Math.floor(rect.width * dpr);
    const h = Math.floor(rect.height * dpr);

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawGrid(ctx, rect.width, rect.height);

    // behind boats
    drawWind(ctx, wind, { x: 90, y: 70 });
    drawStartLine(ctx, startLine);
    for (const m of marks) drawMark(ctx, m);

    // tracks (under ghosts + boats)
    ctx.save();
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    for (const b of boats) {
      const steps = stepsByBoatId[b.id] || [];
      if (steps.length < 2) continue;

      const pts = sampleStepsPath(steps, segmentsByBoatId[b.id] || [], 24);
      if (pts.length < 2) continue;

      ctx.beginPath();
      pts.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.stroke();
    }
    ctx.restore();

    // ghosts
    const snappedNow = snapTime(timeMs, fps);
    const frame = frameStepMs(fps);

    for (const b of boats) {
      const laneSteps = sortSteps(stepsByBoatId[b.id] || []);
      if (laneSteps.length === 0) continue;

      const closestI = findClosestStepIndex(laneSteps, snappedNow);

      for (let i = 0; i < laneSteps.length; i++) {
        const s = laneSteps[i];

        const poseAtStep = interpolateBoatsAtTimeFromSteps(
          boats,
          stepsByBoatId,
          segmentsByBoatId,
          s.tMs,
        ).find((x) => x.id === b.id);

        if (!poseAtStep) continue;

        const isClosest =
          i === closestI &&
          Math.abs((laneSteps[closestI]?.tMs ?? 0) - snappedNow) <= frame;

        ctx.save();
        ctx.globalAlpha = isClosest ? 0.45 : 0.18;

        drawBoat(ctx, {
          ...poseAtStep,
          label: "",
          color: isClosest ? b.color : "#94a3b8",
        });

        ctx.globalAlpha = isClosest ? 0.75 : 0.45;
        drawStepBadge(ctx, poseAtStep.x, poseAtStep.y - 44, String(i + 1));

        ctx.restore();
      }
    }

    // current boats
    for (const b of displayedBoats) {
      drawBoat(ctx, b);

      if (b.id === selectedBoatId) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x, b.y, 38, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 6]);
        ctx.stroke();
        ctx.restore();
      }

      if (startLine.startBoatId && b.id === startLine.startBoatId) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x, b.y, 44, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(16,185,129,0.35)";
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.restore();
      }
    }

    // flags overlay
    for (const f of flags) {
      const code = resolveActiveFlagCode(f, flagClipsByFlagId[f.id], timeMs);
      if (!code) continue;
      drawFlag(ctx, f, code, selectedFlagId === f.id);
    }

    // time indicator
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.textAlign = "left";
    ctx.fillText(`t = ${formatTime(timeMs)} / ${formatTime(durationMs)}`, 12, 18);
    ctx.restore();
  }, [
    canvasRef,
    boats,
    displayedBoats,
    stepsByBoatId,
    segmentsByBoatId,
    timeMs,
    durationMs,
    fps,
    selectedBoatId,
    marks,
    wind,
    startLine,
    flags,
    flagClipsByFlagId,
    selectedFlagId,
    assetTick,
  ]);
}