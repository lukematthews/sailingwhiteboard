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
import type { Camera } from "./camera";
import { screenToWorld } from "./camera";

type Args = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;

  // ✅ camera
  camera: Camera;

  // state (inputs)
  autoKey: boolean; // kept to mirror your existing dep pattern
  tool: ToolMode;
  snapToGrid: boolean;
  timeMs: number;
  fps: number;

  // playback control (pause on interaction to avoid step spam)
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;

  // ✅ visibility toggles
  showMarks: boolean;
  showStartLine: boolean;

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
    camera,
    autoKey,
    tool,
    snapToGrid,
    timeMs,
    fps,

    isPlaying,
    setIsPlaying,

    showMarks,
    showStartLine,

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
  const cameraRef = useRef<Camera>(camera);
  const toolRef = useRef<ToolMode>(tool);
  const snapRef = useRef<boolean>(snapToGrid);
  const timeRef = useRef<number>(timeMs);
  const fpsRef = useRef<number>(fps);

  // playback refs
  const isPlayingRef = useRef<boolean>(isPlaying);
  const setIsPlayingRef = useRef(setIsPlaying);

  // visibility refs
  const showMarksRef = useRef<boolean>(showMarks);
  const showStartLineRef = useRef<boolean>(showStartLine);

  const marksRef = useRef<Mark[]>(marks);
  const startLineRef = useRef<StartLine>(startLine);
  const flagsRef = useRef<Flag[]>(flags);
  const flagClipsRef = useRef<FlagClipsByFlagId>(flagClipsByFlagId);
  const displayedBoatsRef = useRef<Boat[]>(displayedBoats);

  useEffect(() => void (cameraRef.current = camera), [camera]);
  useEffect(() => void (toolRef.current = tool), [tool]);
  useEffect(() => void (snapRef.current = snapToGrid), [snapToGrid]);
  useEffect(() => void (timeRef.current = timeMs), [timeMs]);
  useEffect(() => void (fpsRef.current = fps), [fps]);

  useEffect(() => void (isPlayingRef.current = isPlaying), [isPlaying]);
  useEffect(
    () => void (setIsPlayingRef.current = setIsPlaying),
    [setIsPlaying],
  );

  useEffect(() => void (showMarksRef.current = showMarks), [showMarks]);
  useEffect(
    () => void (showStartLineRef.current = showStartLine),
    [showStartLine],
  );

  useEffect(() => void (marksRef.current = marks), [marks]);
  useEffect(() => void (startLineRef.current = startLine), [startLine]);
  useEffect(() => void (flagsRef.current = flags), [flags]);
  useEffect(
    () => void (flagClipsRef.current = flagClipsByFlagId),
    [flagClipsByFlagId],
  );
  useEffect(
    () => void (displayedBoatsRef.current = displayedBoats),
    [displayedBoats],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ✅ Prevent browser touch gestures (pinch-to-zoom / scroll) on canvas
    // Pan/zoom hook + our pointer interactions assume full control.
    canvas.style.touchAction = "none";

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

    // Screen point in canvas CSS pixels
    const getScreenPoint = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    // ✅ World point (after camera)
    const getWorldPoint = (e: PointerEvent) => {
      const pScreen = getScreenPoint(e);
      return screenToWorld(pScreen, cameraRef.current);
    };

    const pauseIfPlaying = () => {
      if (isPlayingRef.current) {
        setIsPlayingRef.current(false);
      }
    };

    const cancelActive = (pointerId?: number) => {
      active = null;
      if (pointerId != null) {
        try {
          canvas.releasePointerCapture(pointerId);
        } catch {}
      }
    };

    const onDown = (e: PointerEvent) => {
      // If you’re using middle mouse / space+drag for pan in useCanvasPanZoom,
      // don’t steal those pointerdowns here.
      // (Pan hook calls preventDefault & capture; this guard is extra safety.)
      if (e.button === 1) return;

      const p = getWorldPoint(e);

      // ------------------------------------------------------------
      // start line handles (ONLY if visible)
      // ------------------------------------------------------------
      if (showStartLineRef.current) {
        const h = hitTestStartHandle(p.x, p.y, startLineRef.current);
        if (h) {
          pauseIfPlaying();
          active = { kind: "start", handle: h };
          setSelectedBoatId(null);
          setSelectedFlagId(null);
          try {
            canvas.setPointerCapture(e.pointerId);
          } catch {}
          e.preventDefault();
          return;
        }
      }

      // ------------------------------------------------------------
      // flags (selectable only if visible now)
      // ------------------------------------------------------------
      const flagsNow = flagsRef.current;
      for (let i = flagsNow.length - 1; i >= 0; i--) {
        const f = flagsNow[i];
        const codeNow = resolveActiveFlagCode(
          f,
          flagClipsRef.current[f.id],
          timeRef.current,
        );
        if (!codeNow) continue;

        if (hitTestFlag(p.x, p.y, f)) {
          pauseIfPlaying();
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

      // ------------------------------------------------------------
      // marks (ONLY if visible)
      // ------------------------------------------------------------
      if (showMarksRef.current) {
        const marksNow = marksRef.current;
        for (let i = marksNow.length - 1; i >= 0; i--) {
          const m = marksNow[i];
          if (hitTestMark(p.x, p.y, m)) {
            pauseIfPlaying();
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
      }

      // ------------------------------------------------------------
      // boats
      // ------------------------------------------------------------
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

      pauseIfPlaying(); // key fix for steps spam

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

      // If visibility toggles changed mid-drag, cancel the interaction.
      if (active.kind === "mark" && !showMarksRef.current) {
        cancelActive(e.pointerId);
        return;
      }
      if (active.kind === "start" && !showStartLineRef.current) {
        cancelActive(e.pointerId);
        return;
      }

      const p = getWorldPoint(e);

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

          setStepsByBoatId((prev) =>
            upsertStep(prev, boatId, nowT, { x: nx, y: ny }),
          );
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
  }, [
    canvasRef,
    camera, // keep cameraRef current (ref updated in effect above)
    setFlags,
    setMarks,
    setStartLine,
    setStepsByBoatId,
    setSelectedBoatId,
    setSelectedFlagId,
    autoKey,

    // keep pauseIfPlaying correct
    isPlaying,
    setIsPlaying,
  ]);
}
