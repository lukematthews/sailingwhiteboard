// src/builder/useCanvasDraw.ts
import { useEffect } from "react";
import { formatTime, snapTime } from "../lib/time";
import { drawBoat, drawBoatOutline } from "../canvas/boat";
import { drawGrid } from "../canvas/grid";
import { drawMark } from "../canvas/marks";
import { MARK_RADIUS_PX } from "../canvas/marks";
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
import type { Camera } from "./camera";
import {
  detectBoatCollisions,
  detectBoatMarkCollisions,
  resolveBoatCollisionsJustTouching,
} from "../canvas/collision";
import { drawImpactStar } from "../canvas/drawStar";

type Args = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  camera: Camera;
  boats: Boat[];
  displayedBoats: Boat[];
  stepsByBoatId: StepsByBoatId;
  segmentsByBoatId: SegmentsByBoatId;
  timeMs: number;
  durationMs: number;
  fps: number;
  selectedBoatId: string | null;
  isPlaying: boolean;

  wind: Wind;

  showMarks: boolean;
  marks: Mark[];
  showStartLine: boolean;
  startLine: StartLine;

  showMarkThreeBL: boolean;
  showBoatTransomLines: boolean;

  flags: Flag[];
  flagClipsByFlagId: FlagClipsByFlagId;
  selectedFlagId: string | null;
  assetTick: number;
};

export function useCanvasDraw(args: Args) {
  const {
    canvasRef,
    camera,
    boats,
    displayedBoats,
    stepsByBoatId,
    segmentsByBoatId,
    timeMs,
    durationMs,
    fps,
    selectedBoatId,
    isPlaying,
    wind,
    showMarks,
    marks,
    showStartLine,
    startLine,
    showMarkThreeBL,
    showBoatTransomLines,
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

    // ============================================================
    // Canvas sizing (DPR-safe)
    // ============================================================
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const w = Math.floor(rect.width * dpr);
    const h = Math.floor(rect.height * dpr);

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    // Reset transform → CSS pixel space
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear full canvas in CSS coords
    ctx.clearRect(0, 0, rect.width, rect.height);

    // ============================================================
    // ✅ CAMERA TRANSFORM (world space begins here)
    // ============================================================
    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    // ============================================================
    // WORLD CONTENT (boats, marks, flags, tracks)
    // ============================================================

    drawGrid(ctx, rect.width, rect.height, camera);
    drawWind(ctx, wind, { x: 90, y: 70 });

    if (showStartLine) drawStartLine(ctx, startLine);

    if (showMarks) {
      for (const m of marks) {
        drawMark(ctx, m, { showThreeBoatLengthCircle: showMarkThreeBL });
      }
    }

    // ------------------------------------------------------------
    // Tracks
    // ------------------------------------------------------------
    ctx.save();
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    for (const b of boats) {
      const steps = stepsByBoatId[b.id] || [];
      if (steps.length < 2) continue;

      const pts = sampleStepsPath(steps, segmentsByBoatId[b.id] || [], 24);
      if (pts.length < 2) continue;

      ctx.beginPath();
      pts.forEach((pt, i) =>
        i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y),
      );

      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.stroke();
    }
    ctx.restore();

    // ------------------------------------------------------------
    // Ghost boats (step previews)
    // ------------------------------------------------------------
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

        drawBoat(
          ctx,
          {
            ...poseAtStep,
            label: "",
            color: isClosest ? b.color : "#94a3b8",
          },
          { showTransomOverlap: showBoatTransomLines },
        );

        ctx.globalAlpha = isClosest ? 0.75 : 0.45;
        drawStepBadge(ctx, poseAtStep.x, poseAtStep.y - 44, String(i + 1));

        ctx.restore();
      }
    }

    // ------------------------------------------------------------
    // Playback “just touching” unless dragging
    // ------------------------------------------------------------
    const draggingBoatId = (canvas as any).__swbDraggingBoatId as
      | string
      | undefined;
    const boatsToDraw = draggingBoatId
      ? displayedBoats
      : resolveBoatCollisionsJustTouching(displayedBoats, { iters: 5 });

    // ------------------------------------------------------------
    // Boat↔Boat collisions
    // ------------------------------------------------------------
    const { collidingBoatIds, contacts } = detectBoatCollisions(boatsToDraw);

    // ------------------------------------------------------------
    // Boat↔Mark collisions (only when marks are visible)
    // ------------------------------------------------------------
    const markColl =
      showMarks && marks.length
        ? detectBoatMarkCollisions(boatsToDraw, marks)
        : {
            collidingBoatIds: new Set<string>(),
            collidingMarkIds: new Set<string>(),
            contacts: [] as Array<{
              x: number;
              y: number;
              boatId: string;
              markId: string;
            }>,
          };

    // ------------------------------------------------------------
    // Current boats + collision outlines
    // ------------------------------------------------------------
    for (const b of boatsToDraw) {
      drawBoat(ctx, b, { showTransomOverlap: showBoatTransomLines });

      // ✅ boat/boat overlap outline
      if (collidingBoatIds.has(b.id)) {
        drawBoatOutline(ctx, b, {
          strokeStyle: "rgba(220,38,38,0.95)",
          lineWidth: 4,
        });
      }

      // ✅ boat/mark outline
      if (markColl.collidingBoatIds.has(b.id)) {
        drawBoatOutline(ctx, b, {
          strokeStyle: "rgba(220,38,38,0.95)",
          lineWidth: 4,
        });
      }

      // Hide selection ring while playing
      if (!isPlaying && b.id === selectedBoatId) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x, b.y, 38, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 6]);
        ctx.stroke();
        ctx.restore();
      }
    }

    // ------------------------------------------------------------
    // Impact stars at boat/boat contact points
    // ------------------------------------------------------------
    for (const p of contacts) {
      drawImpactStar(ctx, p.x, p.y, { outerR: 11, innerR: 5, points: 5 });
    }

    // ------------------------------------------------------------
    // Impact stars + mark rings for boat/mark contacts
    // ------------------------------------------------------------
    if (showMarks) {
      // ring any colliding mark
      for (const m of marks) {
        if (!markColl.collidingMarkIds.has(m.id)) continue;

        ctx.save();
        ctx.beginPath();
        ctx.arc(m.x, m.y, MARK_RADIUS_PX + 4, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(220,38,38,0.95)";
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 6]);
        ctx.stroke();
        ctx.restore();
      }

      // stars on the hull at contact points
      for (const c of markColl.contacts) {
        drawImpactStar(ctx, c.x, c.y, { outerR: 11, innerR: 5, points: 5 });
      }
    }

    // ------------------------------------------------------------
    // ✅ Drag contact overlay (boat/boat) from interactions
    // ------------------------------------------------------------
    const dragContact = (canvas as any).__swbDragContact as
      | undefined
      | { boatId: string; otherId: string; point: { x: number; y: number } };

    if (dragContact) {
      const a = boatsToDraw.find((b) => b.id === dragContact.boatId);
      const o = boatsToDraw.find((b) => b.id === dragContact.otherId);

      if (a) {
        drawBoatOutline(ctx, a, {
          strokeStyle: "rgba(220,38,38,0.95)",
          lineWidth: 4,
        });
      }
      if (o) {
        drawBoatOutline(ctx, o, {
          strokeStyle: "rgba(220,38,38,0.75)",
          lineWidth: 3,
        });
      }

      drawImpactStar(ctx, dragContact.point.x, dragContact.point.y, {
        outerR: 11,
        innerR: 5,
        points: 5,
      });
    }

    // ------------------------------------------------------------
    // Flags
    // ------------------------------------------------------------
    for (const f of flags) {
      const code = resolveActiveFlagCode(f, flagClipsByFlagId[f.id], timeMs);
      if (!code) continue;
      drawFlag(ctx, f, code, selectedFlagId === f.id);
    }

    // ============================================================
    // END CAMERA TRANSFORM
    // ============================================================
    ctx.restore();

    // ============================================================
    // UI OVERLAY (screen-space only)
    // ============================================================
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.textAlign = "left";
    ctx.fillText(
      `t = ${formatTime(timeMs)} / ${formatTime(durationMs)}`,
      12,
      18,
    );
    ctx.restore();
  }, [
    canvasRef,
    camera,
    boats,
    displayedBoats,
    stepsByBoatId,
    segmentsByBoatId,
    timeMs,
    durationMs,
    fps,
    selectedBoatId,
    isPlaying,
    wind,
    showMarks,
    marks,
    showStartLine,
    startLine,
    showMarkThreeBL,
    showBoatTransomLines,
    flags,
    flagClipsByFlagId,
    selectedFlagId,
    assetTick,
  ]);
}
