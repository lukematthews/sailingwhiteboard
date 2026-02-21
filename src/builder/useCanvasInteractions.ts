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

  // camera
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

  // visibility toggles
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

/**
 * Mobile-first interaction rules:
 * - Touch:
 *    - 1 finger: pan (handled by useCanvasPanZoom)
 *    - 2 fingers: pinch (handled by useCanvasPanZoom)
 *    - double-tap: select nearest boat/flag (and clear the other selection)
 *    - long-press on an entity: drag it (boats, marks, flags, startline handles)
 * - Mouse:
 *    - keep existing click-drag behaviours (drag boats/marks/flags/startline, rotate tool)
 *
 * Long-press entity dragging cooperates with the pan/zoom hook by setting:
 *   (canvas as any).__swbTouchEntityDragPointerId = <pointerId>
 * The camera hook will ignore that pointer id.
 */
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

    // Prevent browser touch gestures on canvas
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

    // Touch long-press state
    const LONG_PRESS_MS = 420;
    const MOVE_SLOP_PX = 10;

    let longPressTimer: number | null = null;
    let pendingTouchPointerId: number | null = null;
    let pendingTouchStartScreen: { x: number; y: number } | null = null;
    let pendingDragCandidate: DragMode = null;

    // Double-tap detection
    const DOUBLE_TAP_MS = 260;
    const DOUBLE_TAP_PX = 22;
    let lastTapTime = 0;
    let lastTapPos: { x: number; y: number } | null = null;

    const clearLongPress = () => {
      if (longPressTimer != null) {
        window.clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      pendingTouchPointerId = null;
      pendingTouchStartScreen = null;
      pendingDragCandidate = null;
    };

    const setTouchDragPointer = (pointerId: number | null) => {
      (canvas as any).__swbTouchEntityDragPointerId = pointerId ?? undefined;
    };

    const getScreenPoint = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const getWorldPointFromScreen = (pScreen: { x: number; y: number }) => {
      return screenToWorld(pScreen, cameraRef.current);
    };

    const getWorldPoint = (e: PointerEvent) => {
      const pScreen = getScreenPoint(e);
      return getWorldPointFromScreen(pScreen);
    };

    const pauseIfPlaying = () => {
      if (isPlayingRef.current) {
        setIsPlayingRef.current(false);
      }
    };

    const cancelActive = (pointerId?: number) => {
      active = null;
      setTouchDragPointer(null);
      clearLongPress();
      if (pointerId != null) {
        try {
          canvas.releasePointerCapture(pointerId);
        } catch {}
      }
    };

    const hitTestForDragCandidate = (pWorld: {
      x: number;
      y: number;
    }): DragMode => {
      // start line handles (if visible)
      if (showStartLineRef.current) {
        const h = hitTestStartHandle(pWorld.x, pWorld.y, startLineRef.current);
        if (h) return { kind: "start", handle: h };
      }

      // flags (only if visible now)
      const flagsNow = flagsRef.current;
      for (let i = flagsNow.length - 1; i >= 0; i--) {
        const f = flagsNow[i];
        const codeNow = resolveActiveFlagCode(
          f,
          flagClipsRef.current[f.id],
          timeRef.current,
        );
        if (!codeNow) continue;

        if (hitTestFlag(pWorld.x, pWorld.y, f)) {
          return {
            kind: "flag",
            flagId: f.id,
            dragOffset: { x: pWorld.x - f.x, y: pWorld.y - f.y },
          };
        }
      }

      // marks (if visible)
      if (showMarksRef.current) {
        const marksNow = marksRef.current;
        for (let i = marksNow.length - 1; i >= 0; i--) {
          const m = marksNow[i];
          if (hitTestMark(pWorld.x, pWorld.y, m)) {
            return {
              kind: "mark",
              markId: m.id,
              dragOffset: { x: pWorld.x - m.x, y: pWorld.y - m.y },
            };
          }
        }
      }

      // boats
      const boatsNow = displayedBoatsRef.current;
      for (let i = boatsNow.length - 1; i >= 0; i--) {
        const b = boatsNow[i];
        if (hitTestBoat(pWorld.x, pWorld.y, b)) {
          const toolNow = toolRef.current;
          if (toolNow === "rotate") {
            return {
              kind: "boat",
              boatId: b.id,
              mode: "rotate",
              dragOffset: { x: 0, y: 0 },
            };
          }
          return {
            kind: "boat",
            boatId: b.id,
            mode: "drag",
            dragOffset: { x: pWorld.x - b.x, y: pWorld.y - b.y },
          };
        }
      }

      return null;
    };

    const applyDragMove = (
      mode: Exclude<DragMode, null>,
      pWorld: { x: number; y: number },
    ) => {
      // If visibility toggles changed mid-drag, cancel the interaction.
      if (mode.kind === "mark" && !showMarksRef.current) return;
      if (mode.kind === "start" && !showStartLineRef.current) return;

      if (mode.kind === "start") {
        const handle = mode.handle;
        setStartLine((s) => ({ ...s, [handle]: { x: pWorld.x, y: pWorld.y } }));
        return;
      }

      if (mode.kind === "flag") {
        const { flagId, dragOffset } = mode;
        const snapNow = snapRef.current;

        setFlags((prev) =>
          prev.map((f) => {
            if (f.id !== flagId) return f;
            let nx = pWorld.x - dragOffset.x;
            let ny = pWorld.y - dragOffset.y;
            if (snapNow) {
              const s = 5;
              nx = Math.round(nx / s) * s;
              ny = Math.round(ny / s) * s;
            }
            return { ...f, x: nx, y: ny };
          }),
        );
        return;
      }

      if (mode.kind === "mark") {
        const { markId, dragOffset } = mode;
        const snapNow = snapRef.current;

        setMarks((prev) =>
          prev.map((m) => {
            if (m.id !== markId) return m;

            let nx = pWorld.x - dragOffset.x;
            let ny = pWorld.y - dragOffset.y;

            if (snapNow) {
              const s = 5;
              nx = Math.round(nx / s) * s;
              ny = Math.round(ny / s) * s;
            }
            return { ...m, x: nx, y: ny };
          }),
        );
        return;
      }

      if (mode.kind === "boat") {
        const { boatId, mode: boatMode, dragOffset } = mode;
        const snapNow = snapRef.current;

        const nowT = snapTime(timeRef.current, fpsRef.current);

        const bNow = displayedBoatsRef.current.find((x) => x.id === boatId);
        if (!bNow) return;

        if (boatMode === "drag") {
          let nx = pWorld.x - dragOffset.x;
          let ny = pWorld.y - dragOffset.y;

          if (snapNow) {
            const s = 5;
            nx = Math.round(nx / s) * s;
            ny = Math.round(ny / s) * s;
          }

          setStepsByBoatId((prev) =>
            upsertStep(prev, boatId, nowT, { x: nx, y: ny }),
          );
          return;
        }

        if (boatMode === "rotate") {
          const dx = pWorld.x - bNow.x;
          const dy = pWorld.y - bNow.y;
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
        }
      }
    };

    const didDoubleTap = (pScreen: { x: number; y: number }) => {
      const now = performance.now();
      const dt = now - lastTapTime;
      if (dt > DOUBLE_TAP_MS || !lastTapPos) return false;

      const dx = pScreen.x - lastTapPos.x;
      const dy = pScreen.y - lastTapPos.y;
      const d = Math.hypot(dx, dy);

      return d <= DOUBLE_TAP_PX;
    };

    const commitTap = (pScreen: { x: number; y: number }) => {
      lastTapTime = performance.now();
      lastTapPos = pScreen;
    };

    const selectOnDoubleTap = (pWorld: { x: number; y: number }) => {
      // Prefer flags if tapped on a currently-visible flag
      const flagsNow = flagsRef.current;
      for (let i = flagsNow.length - 1; i >= 0; i--) {
        const f = flagsNow[i];
        const codeNow = resolveActiveFlagCode(
          f,
          flagClipsRef.current[f.id],
          timeRef.current,
        );
        if (!codeNow) continue;
        if (hitTestFlag(pWorld.x, pWorld.y, f)) {
          setSelectedFlagId(f.id);
          setSelectedBoatId(null);
          return;
        }
      }

      // Then boats
      const boatsNow = displayedBoatsRef.current;
      for (let i = boatsNow.length - 1; i >= 0; i--) {
        const b = boatsNow[i];
        if (hitTestBoat(pWorld.x, pWorld.y, b)) {
          setSelectedBoatId(b.id);
          setSelectedFlagId(null);
          return;
        }
      }

      // No selection model exists yet for marks/startline in the app;
      // for now, clear selection when double-tapping empty space.
      setSelectedBoatId(null);
      setSelectedFlagId(null);
    };

    // ------------------------------------------------------------
    // POINTER HANDLERS
    // ------------------------------------------------------------
    const onDown = (e: PointerEvent) => {
      if (e.button === 1) return;

      // Touch: mobile-first (pan/zoom in camera hook). We only do:
      // - double tap selection
      // - long press to drag entity
      if (e.pointerType === "touch") {
        const pScreen = getScreenPoint(e);

        // double tap: select and bail
        if (didDoubleTap(pScreen)) {
          clearLongPress();
          pauseIfPlaying();
          const pWorld = getWorldPointFromScreen(pScreen);
          selectOnDoubleTap(pWorld);
          // don't start a long press on the second tap
          e.preventDefault();
          return;
        }

        commitTap(pScreen);

        // prepare long-press candidate (if finger is down on an entity)
        const pWorld = getWorldPointFromScreen(pScreen);
        const candidate = hitTestForDragCandidate(pWorld);
        if (!candidate) {
          clearLongPress();
          return; // allow pan
        }

        pendingTouchPointerId = e.pointerId;
        pendingTouchStartScreen = pScreen;
        pendingDragCandidate = candidate;

        // Schedule long-press to "enter drag mode"
        if (longPressTimer != null) window.clearTimeout(longPressTimer);
        longPressTimer = window.setTimeout(() => {
          // still the same pointer?
          if (pendingTouchPointerId !== e.pointerId) return;
          if (!pendingDragCandidate) return;

          pauseIfPlaying();

          // activate drag
          active = pendingDragCandidate;

          // set selection if applicable
          if (active.kind === "boat") {
            setSelectedBoatId(active.boatId);
            setSelectedFlagId(null);
          } else if (active.kind === "flag") {
            setSelectedFlagId(active.flagId);
            setSelectedBoatId(null);
          } else {
            // marks/startline have no selection state currently; just clear
            setSelectedBoatId(null);
            setSelectedFlagId(null);
          }

          setTouchDragPointer(e.pointerId);

          try {
            canvas.setPointerCapture(e.pointerId);
          } catch {}

          // once active, no longer pending
          pendingDragCandidate = null;
          pendingTouchStartScreen = null;
          pendingTouchPointerId = null;
          longPressTimer = null;
        }, LONG_PRESS_MS);

        return;
      }

      // ------------------------------------------------------------
      // Desktop pointerdown: existing behaviour
      // ------------------------------------------------------------
      const p = getWorldPoint(e);

      // start line handles (ONLY if visible)
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

      // flags
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

      // marks
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

      pauseIfPlaying();

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
      // Touch: cancel long press if user starts moving (pan intent)
      if (e.pointerType === "touch") {
        // If we are actively dragging an entity, apply drag move.
        if (active) {
          const pWorld = getWorldPoint(e);
          applyDragMove(active, pWorld);
          e.preventDefault();
          return;
        }

        // Not active: if we have a pending long press, cancel if moved too far.
        if (
          pendingTouchPointerId === e.pointerId &&
          pendingTouchStartScreen &&
          longPressTimer != null
        ) {
          const p = getScreenPoint(e);
          const dx = p.x - pendingTouchStartScreen.x;
          const dy = p.y - pendingTouchStartScreen.y;
          const d = Math.hypot(dx, dy);
          if (d > MOVE_SLOP_PX) {
            clearLongPress();
          }
        }
        return;
      }

      // Desktop drag moves
      if (!active) return;

      const p = getWorldPoint(e);
      applyDragMove(active, p);
      e.preventDefault();
    };

    const onUp = (e: PointerEvent) => {
      // Clear any pending long press
      if (e.pointerType === "touch") {
        clearLongPress();
      }

      active = null;
      setTouchDragPointer(null);

      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove, { passive: false } as any);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    return () => {
      cancelActive();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove as any);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, [
    canvasRef,
    camera,
    setFlags,
    setMarks,
    setStartLine,
    setStepsByBoatId,
    setSelectedBoatId,
    setSelectedFlagId,
    autoKey,
    isPlaying,
    setIsPlaying,
  ]);
}
