// src/builder/useCanvasInteractions.ts
import { useEffect, useRef } from "react";
import { snapTime } from "../lib/time";
import { upsertStep } from "../animation/steps";
import type {
  Boat,
  Flag,
  FlagClipsByFlagId,
  Mark,
  StartLine,
  StepsByBoatId,
  ToolMode,
} from "../types";
import { hitTestBoat } from "../canvas/hitTest";
import { hitTestMark } from "../canvas/marks";
import { hitTestStartHandle } from "../canvas/startLine";
import { hitTestFlag, resolveActiveFlagCode } from "../canvas/flags";

type Args = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;

  // state (inputs)
  autoKey: boolean; // kept to mirror your existing dep pattern
  tool: ToolMode;
  snapToGrid: boolean;
  timeMs: number;
  fps: number;

  marks: Mark[];
  startLine: StartLine;
  flags: Flag[];
  flagClipsByFlagId: FlagClipsByFlagId;

  displayedBoats: Boat[]; // boats at playhead (for hit testing)
  setStepsByBoatId: React.Dispatch<React.SetStateAction<StepsByBoatId>>;
  setMarks: React.Dispatch<React.SetStateAction<Mark[]>>;
  setStartLine: React.Dispatch<React.SetStateAction<StartLine>>;
  setFlags: React.Dispatch<React.SetStateAction<Flag[]>>;

  // selection setters (keep identical behaviour)
  setSelectedBoatId: (id: string | null) => void;
  setSelectedFlagId: (id: string | null) => void;
};

export function useCanvasInteractions(args: Args) {
  const {
    canvasRef,
    autoKey,
    tool,
    snapToGrid,
    timeMs,
    fps,
    marks,
    startLine,
    flags,
    flagClipsByFlagId,
    displayedBoats,
    setStepsByBoatId,
    setMarks,
    setStartLine,
    setFlags,
    setSelectedBoatId,
    setSelectedFlagId,
  } = args;

  // refs to avoid stale closures in pointer handlers
  const toolRef = useRef<ToolMode>(tool);
  const snapRef = useRef<boolean>(snapToGrid);
  const timeRef = useRef<number>(timeMs);
  const fpsRef = useRef<number>(fps);

  const marksRef = useRef<Mark[]>(marks);
  const startLineRef = useRef<StartLine>(startLine);
  const flagsRef = useRef<Flag[]>(flags);
  const flagClipsRef = useRef<FlagClipsByFlagId>(flagClipsByFlagId);
  const displayedBoatsRef = useRef<Boat[]>(displayedBoats);

  useEffect(() => void (toolRef.current = tool), [tool]);
  useEffect(() => void (snapRef.current = snapToGrid), [snapToGrid]);
  useEffect(() => void (timeRef.current = timeMs), [timeMs]);
  useEffect(() => void (fpsRef.current = fps), [fps]);

  useEffect(() => void (marksRef.current = marks), [marks]);
  useEffect(() => void (startLineRef.current = startLine), [startLine]);
  useEffect(() => void (flagsRef.current = flags), [flags]);
  useEffect(() => void (flagClipsRef.current = flagClipsByFlagId), [flagClipsByFlagId]);
  useEffect(() => void (displayedBoatsRef.current = displayedBoats), [displayedBoats]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    type DragMode =
      | { kind: "flag"; flagId: string; dragOffset: { x: number; y: number } }
      | { kind: "start"; handle: "committee" | "pin" }
      | { kind: "mark"; markId: string; dragOffset: { x: number; y: number } }
      | {
          kind: "boat";
          boatId: string;
          mode: "drag" | "rotate";
          dragOffset: { x: number; y: number };
        }
      | null;

    let active: DragMode = null;

    const getPoint = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onDown = (e: PointerEvent) => {
      const p = getPoint(e);

      // start line handles
      const h = hitTestStartHandle(p.x, p.y, startLineRef.current);
      if (h) {
        active = { kind: "start", handle: h };
        setSelectedBoatId(null);
        setSelectedFlagId(null);
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {}
        e.preventDefault();
        return;
      }

      // flags (selectable only if visible now)
      const flagsNow = flagsRef.current;
      for (let i = flagsNow.length - 1; i >= 0; i--) {
        const f = flagsNow[i];
        const codeNow = resolveActiveFlagCode(f, flagClipsRef.current[f.id], timeRef.current);
        if (!codeNow) continue;

        if (hitTestFlag(p.x, p.y, f)) {
          active = {
            kind: "flag",
            flagId: f.id,
            dragOffset: { x: p.x - f.x, y: p.y - f.y },
          };
          setSelectedFlagId(f.id);
          setSelectedBoatId(null);
          try {
            canvas.setPointerCapture(e.pointerId);
          } catch {}
          e.preventDefault();
          return;
        }
      }

      // marks
      const marksNow = marksRef.current;
      for (let i = marksNow.length - 1; i >= 0; i--) {
        const m = marksNow[i];
        if (hitTestMark(p.x, p.y, m)) {
          active = {
            kind: "mark",
            markId: m.id,
            dragOffset: { x: p.x - m.x, y: p.y - m.y },
          };
          setSelectedBoatId(null);
          setSelectedFlagId(null);
          try {
            canvas.setPointerCapture(e.pointerId);
          } catch {}
          e.preventDefault();
          return;
        }
      }

      // boats
      const boatsNow = displayedBoatsRef.current;
      let hit: Boat | null = null;
      for (let i = boatsNow.length - 1; i >= 0; i--) {
        const b = boatsNow[i];
        if (hitTestBoat(p.x, p.y, b)) {
          hit = b;
          break;
        }
      }

      if (!hit) {
        active = null;
        setSelectedBoatId(null);
        setSelectedFlagId(null);
        return;
      }

      setSelectedBoatId(hit.id);
      setSelectedFlagId(null);

      const toolNow = toolRef.current;
      if (toolNow === "rotate") {
        active = {
          kind: "boat",
          boatId: hit.id,
          mode: "rotate",
          dragOffset: { x: 0, y: 0 },
        };
      } else {
        active = {
          kind: "boat",
          boatId: hit.id,
          mode: "drag",
          dragOffset: { x: p.x - hit.x, y: p.y - hit.y },
        };
      }

      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {}
      e.preventDefault();
    };

    const onMove = (e: PointerEvent) => {
      if (!active) return;
      const p = getPoint(e);

      if (active.kind === "start") {
        const handle = active.handle;
        setStartLine((s) => ({ ...s, [handle]: { x: p.x, y: p.y } }));
        e.preventDefault();
        return;
      }

      if (active.kind === "flag") {
        const { flagId, dragOffset } = active;
        const snapNow = snapRef.current;

        setFlags((prev) =>
          prev.map((f) => {
            if (f.id !== flagId) return f;
            let nx = p.x - dragOffset.x;
            let ny = p.y - dragOffset.y;
            if (snapNow) {
              const s = 5;
              nx = Math.round(nx / s) * s;
              ny = Math.round(ny / s) * s;
            }
            return { ...f, x: nx, y: ny };
          }),
        );
        e.preventDefault();
        return;
      }

      if (active.kind === "mark") {
        const markId = active.markId;
        const offset = active.dragOffset;
        const snapNow = snapRef.current;

        setMarks((prev) =>
          prev.map((m) => {
            if (m.id !== markId) return m;

            let nx = p.x - offset.x;
            let ny = p.y - offset.y;

            if (snapNow) {
              const s = 5;
              nx = Math.round(nx / s) * s;
              ny = Math.round(ny / s) * s;
            }
            return { ...m, x: nx, y: ny };
          }),
        );

        e.preventDefault();
        return;
      }

      if (active.kind === "boat") {
        const boatId = active.boatId;
        const mode = active.mode;
        const offset = active.dragOffset;
        const snapNow = snapRef.current;

        const nowT = snapTime(timeRef.current, fpsRef.current);

        const bNow = displayedBoatsRef.current.find((x) => x.id === boatId);
        if (!bNow) return;

        if (mode === "drag") {
          let nx = p.x - offset.x;
          let ny = p.y - offset.y;

          if (snapNow) {
            const s = 5;
            nx = Math.round(nx / s) * s;
            ny = Math.round(ny / s) * s;
          }

          setStepsByBoatId((prev) => upsertStep(prev, boatId, nowT, { x: nx, y: ny }));
          e.preventDefault();
          return;
        }

        if (mode === "rotate") {
          const dx = p.x - bNow.x;
          const dy = p.y - bNow.y;
          const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
          const heading = (ang + 90 + 360) % 360;

          setStepsByBoatId((prev) =>
            upsertStep(prev, boatId, nowT, {
              x: bNow.x,
              y: bNow.y,
              headingMode: "manual",
              headingDeg: heading,
            }),
          );

          e.preventDefault();
          return;
        }
      }
    };

    const onUp = (e: PointerEvent) => {
      active = null;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, [canvasRef, setFlags, setMarks, setStartLine, setStepsByBoatId, setSelectedBoatId, setSelectedFlagId, autoKey]);
}