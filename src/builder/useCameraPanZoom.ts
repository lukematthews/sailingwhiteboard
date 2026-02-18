// src/builder/useCanvasPanZoom.ts
import { useEffect, useRef } from "react";
import type { Camera } from "./camera";
import { screenToWorld } from "./camera";

type Point = { x: number; y: number };

type Args = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  camera: Camera;
  setCamera: React.Dispatch<React.SetStateAction<Camera>>;

  /**
   * Return true if a left-drag should start panning from this point.
   * This is called on pointerdown with a WORLD point (camera applied).
   *
   * Typical usage:
   *   shouldStartPan: (pWorld) => !isOverAnyObject(pWorld)
   */
  shouldStartPan?: (pWorld: Point) => boolean;

  enabled?: boolean;

  minZoom?: number;
  maxZoom?: number;
  wheelZoomSpeed?: number; // 0.0015 nice default
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function useCanvasPanZoom({
  canvasRef,
  camera,
  setCamera,
  shouldStartPan,
  enabled = true,
  minZoom = 0.25,
  maxZoom = 4,
  wheelZoomSpeed = 0.0015,
}: Args) {
  const camRef = useRef(camera);
  useEffect(() => void (camRef.current = camera), [camera]);

  // Spacebar pan support
  const spaceDownRef = useRef(false);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceDownRef.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceDownRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled) return;

    const getScreenPoint = (e: PointerEvent | WheelEvent): Point => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    // ---------------------------------------------------------------------
    // Wheel zoom (desktop) - zoom to cursor
    // ---------------------------------------------------------------------
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      const pScreen = getScreenPoint(e);
      const cam = camRef.current;

      const zoom = cam.zoom;
      const delta = -e.deltaY; // wheel up = zoom in
      const factor = Math.exp(delta * wheelZoomSpeed);
      const nextZoom = clamp(zoom * factor, minZoom, maxZoom);

      // keep world point under cursor fixed
      const wx = (pScreen.x - cam.x) / zoom;
      const wy = (pScreen.y - cam.y) / zoom;

      const nextX = pScreen.x - wx * nextZoom;
      const nextY = pScreen.y - wy * nextZoom;

      setCamera({ x: nextX, y: nextY, zoom: nextZoom });
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });

    // ---------------------------------------------------------------------
    // Drag pan (desktop)
    // - Middle mouse always pans
    // - Space + left pans
    // - Left pans if shouldStartPan(worldPoint) === true
    // ---------------------------------------------------------------------
    let panning = false;
    let panPointerId: number | null = null;
    let panStartClient: Point = { x: 0, y: 0 };
    let camStart: Point = { x: 0, y: 0 };

    const shouldStartPanForPointerDown = (e: PointerEvent) => {
      // Touch panning handled separately (two-finger)
      if (e.pointerType === "touch") return false;

      const isMiddle = e.button === 1;
      const isSpaceLeft = e.button === 0 && spaceDownRef.current;

      if (isMiddle || isSpaceLeft) return true;

      // Left click-drag: only if user started on empty space
      if (e.button === 0) {
        if (!shouldStartPan) return false; // safer default: don't steal left-drag
        const pScreen = getScreenPoint(e);
        const pWorld = screenToWorld(pScreen, camRef.current);
        return shouldStartPan(pWorld);
      }

      return false;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!shouldStartPanForPointerDown(e)) return;

      e.preventDefault();
      panning = true;
      panPointerId = e.pointerId;
      panStartClient = { x: e.clientX, y: e.clientY };
      camStart = { x: camRef.current.x, y: camRef.current.y };

      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {}
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!panning || e.pointerId !== panPointerId) return;

      e.preventDefault();
      const dx = e.clientX - panStartClient.x;
      const dy = e.clientY - panStartClient.y;

      setCamera((c) => ({ ...c, x: camStart.x + dx, y: camStart.y + dy }));
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== panPointerId) return;
      panning = false;
      panPointerId = null;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    // ---------------------------------------------------------------------
    // Mobile pinch + two-finger pan (pointer events)
    // - only acts when 2+ touch pointers are active
    // - prevents page scroll while pinching
    // ---------------------------------------------------------------------
    const activeTouches = new Map<number, Point>();

    let pinchStartDist = 0;
    let pinchStartZoom = 1;
    let pinchStartCam: Point = { x: 0, y: 0 };
    let pinchStartMid: Point = { x: 0, y: 0 };

    const onTouchPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;

      const p = getScreenPoint(e);
      activeTouches.set(e.pointerId, p);

      if (activeTouches.size === 2) {
        const pts = Array.from(activeTouches.values());
        const a = pts[0];
        const b = pts[1];

        pinchStartDist = dist(a, b);
        pinchStartZoom = camRef.current.zoom;
        pinchStartCam = { x: camRef.current.x, y: camRef.current.y };
        pinchStartMid = midpoint(a, b);
      }
    };

    const onTouchPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      if (!activeTouches.has(e.pointerId)) return;

      const p = getScreenPoint(e);
      activeTouches.set(e.pointerId, p);

      if (activeTouches.size < 2) return;

      // block page scroll / rubber band while pinching
      e.preventDefault();

      const pts = Array.from(activeTouches.values());
      const a = pts[0];
      const b = pts[1];

      const d = dist(a, b);
      const mid = midpoint(a, b);

      const startZoom = pinchStartZoom;
      const factor = d / Math.max(1, pinchStartDist);
      const nextZoom = clamp(startZoom * factor, minZoom, maxZoom);

      // Pan via midpoint delta
      const dx = mid.x - pinchStartMid.x;
      const dy = mid.y - pinchStartMid.y;

      // Keep world point under initial midpoint stable
      const wx = (pinchStartMid.x - pinchStartCam.x) / startZoom;
      const wy = (pinchStartMid.y - pinchStartCam.y) / startZoom;

      const nextX = pinchStartMid.x + dx - wx * nextZoom;
      const nextY = pinchStartMid.y + dy - wy * nextZoom;

      setCamera({ x: nextX, y: nextY, zoom: nextZoom });
    };

    const onTouchPointerUp = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      activeTouches.delete(e.pointerId);

      if (activeTouches.size < 2) {
        pinchStartDist = 0;
      }
    };

    canvas.addEventListener("pointerdown", onTouchPointerDown);
    canvas.addEventListener("pointermove", onTouchPointerMove, {
      passive: false,
    } as any);
    canvas.addEventListener("pointerup", onTouchPointerUp);
    canvas.addEventListener("pointercancel", onTouchPointerUp);

    return () => {
      canvas.removeEventListener("wheel", onWheel as any);

      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);

      canvas.removeEventListener("pointerdown", onTouchPointerDown);
      canvas.removeEventListener("pointermove", onTouchPointerMove as any);
      canvas.removeEventListener("pointerup", onTouchPointerUp);
      canvas.removeEventListener("pointercancel", onTouchPointerUp);
    };
  }, [
    canvasRef,
    enabled,
    maxZoom,
    minZoom,
    setCamera,
    shouldStartPan,
    wheelZoomSpeed,
  ]);
}
