Cool. The “same usability as other similar UI” basically means: wheel zoom to cursor + click-drag pan, and on mobile two-finger pinch zoom + two-finger pan (with one-finger reserved for object interactions).

Here’s a clean, drop-in architecture that won’t fight your existing hit-testing/drag logic.

⸻

The core decision: camera transform + coordinate helpers

Create a camera:
```
export type Camera = {
  x: number;   // screen-space translation in CSS px
  y: number;
  zoom: number; // scale factor (1 = 100%)
};
```

And helpers to convert between screen (pointer events) and world (your boat/mark coordinates):

```
export function screenToWorld(p: { x: number; y: number }, cam: Camera) {
  return { x: (p.x - cam.x) / cam.zoom, y: (p.y - cam.y) / cam.zoom };
}

export function worldToScreen(p: { x: number; y: number }, cam: Camera) {
  return { x: p.x * cam.zoom + cam.x, y: p.y * cam.zoom + cam.y };
}
```
You’ll use this in draw and in all hit tests / drags.

⸻

1) Apply camera in useCanvasDraw

Right now you draw in “screen coords”. Change it to:
	•	keep ctx.setTransform(dpr...) for crispness
	•	then apply camera in CSS pixels (not DPR pixels)
	•	draw everything in world space
```
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

// clear in CSS px coords (because you set transform to dpr)
ctx.clearRect(0, 0, rect.width, rect.height);

// camera transform in CSS px
ctx.save();
ctx.translate(camera.x, camera.y);
ctx.scale(camera.zoom, camera.zoom);

// ✅ everything below is world-space now
drawGrid(ctx, rect.width, rect.height); // might need to adapt grid later
drawWind(...);
drawMarks(...);
drawBoats(...);

ctx.restore();
```
Important: Anything that should stay in UI overlay space (like your “t= …” label) should be drawn after ctx.restore().

⸻

2) Add useCanvasPanZoom hook (desktop + mobile-ready)

This hook:
	•	wheel zoom to cursor (desktop)
	•	drag pan with:
	•	middle mouse OR
	•	spacebar + left mouse OR
	•	trackpad two-finger pan is usually handled as wheel scroll (optional later)
	•	pinch zoom + two-finger pan (mobile)

src/builder/useCanvasPanZoom.ts
```
import { useEffect, useRef } from "react";
import type { Camera } from "./cameraTypes";

type Args = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  camera: Camera;
  setCamera: React.Dispatch<React.SetStateAction<Camera>>;

  // optional: allow panning without a tool (spacebar style)
  enabled?: boolean;

  // tune
  minZoom?: number;
  maxZoom?: number;
  wheelZoomSpeed?: number; // 0.0015 is a nice default
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function useCanvasPanZoom({
  canvasRef,
  camera,
  setCamera,
  enabled = true,
  minZoom = 0.25,
  maxZoom = 4,
  wheelZoomSpeed = 0.0015,
}: Args) {
  const camRef = useRef(camera);
  useEffect(() => void (camRef.current = camera), [camera]);

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

    const getPoint = (e: PointerEvent | WheelEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    // ---- Wheel zoom (desktop) ----
    const onWheel = (e: WheelEvent) => {
      // If you want trackpad pan later: if (e.ctrlKey) zoom else pan.
      // For now: always zoom.
      e.preventDefault();

      const p = getPoint(e);
      const cam = camRef.current;

      const zoom = cam.zoom;
      const delta = -e.deltaY; // wheel up = zoom in
      const factor = Math.exp(delta * wheelZoomSpeed);
      const nextZoom = clamp(zoom * factor, minZoom, maxZoom);

      // Zoom around cursor:
      // Keep world point under cursor fixed.
      const wx = (p.x - cam.x) / zoom;
      const wy = (p.y - cam.y) / zoom;

      const nextX = p.x - wx * nextZoom;
      const nextY = p.y - wy * nextZoom;

      setCamera({ x: nextX, y: nextY, zoom: nextZoom });
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });

    // ---- Drag pan (middle mouse OR space+left) ----
    let panning = false;
    let panPointerId: number | null = null;
    let panStart = { x: 0, y: 0 };
    let camStart = { x: 0, y: 0 };

    const shouldStartPan = (e: PointerEvent) => {
      const isMiddle = e.button === 1;
      const isSpaceLeft = e.button === 0 && spaceDownRef.current;
      return isMiddle || isSpaceLeft;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!shouldStartPan(e)) return;

      e.preventDefault();
      panning = true;
      panPointerId = e.pointerId;
      panStart = { x: e.clientX, y: e.clientY };
      camStart = { x: camRef.current.x, y: camRef.current.y };

      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {}
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!panning || e.pointerId !== panPointerId) return;

      e.preventDefault();
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;

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

    // ---- Mobile pinch + two-finger pan ----
    // We’ll only act when 2+ active pointers exist; this prevents fighting object drag.
    const active = new Map<number, { x: number; y: number }>();
    let pinchStartDist = 0;
    let pinchStartZoom = 1;
    let pinchStartCam = { x: 0, y: 0 };
    let pinchStartMid = { x: 0, y: 0 };

    const dist = (a: any, b: any) =>
      Math.hypot(a.x - b.x, a.y - b.y);

    const midpoint = (a: any, b: any) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

    const onTouchPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      const p = getPoint(e);
      active.set(e.pointerId, p);

      if (active.size === 2) {
        const pts = Array.from(active.values());
        const a = pts[0], b = pts[1];
        pinchStartDist = dist(a, b);
        pinchStartZoom = camRef.current.zoom;
        pinchStartCam = { x: camRef.current.x, y: camRef.current.y };
        pinchStartMid = midpoint(a, b);
      }
    };

    const onTouchPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      if (!active.has(e.pointerId)) return;

      const p = getPoint(e);
      active.set(e.pointerId, p);

      if (active.size < 2) return;

      // Prevent page scroll / rubber band while pinching
      e.preventDefault();

      const pts = Array.from(active.values());
      const a = pts[0], b = pts[1];
      const d = dist(a, b);
      const mid = midpoint(a, b);

      const cam = camRef.current;
      const startZoom = pinchStartZoom;

      const factor = d / Math.max(1, pinchStartDist);
      const nextZoom = clamp(startZoom * factor, minZoom, maxZoom);

      // Pan: move camera by the midpoint delta
      const dx = mid.x - pinchStartMid.x;
      const dy = mid.y - pinchStartMid.y;

      // Zoom around midpoint: keep world point under midpoint stable
      const wx = (pinchStartMid.x - pinchStartCam.x) / startZoom;
      const wy = (pinchStartMid.y - pinchStartCam.y) / startZoom;

      const nextX = (pinchStartMid.x + dx) - wx * nextZoom;
      const nextY = (pinchStartMid.y + dy) - wy * nextZoom;

      setCamera({ x: nextX, y: nextY, zoom: nextZoom });
    };

    const onTouchPointerUp = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      active.delete(e.pointerId);
      if (active.size < 2) {
        pinchStartDist = 0;
      }
    };

    canvas.addEventListener("pointerdown", onTouchPointerDown);
    canvas.addEventListener("pointermove", onTouchPointerMove, { passive: false } as any);
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
  }, [canvasRef, enabled, maxZoom, minZoom, setCamera, wheelZoomSpeed]);
}
```

⸻

3) Integrate in SailingAnimationBuilder.tsx

Add camera state:

const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });

Call hook:

useCanvasPanZoom({ canvasRef, camera, setCamera });

Pass camera into useCanvasDraw and useCanvasInteractions.

⸻

4) Update interactions to use world coords

Right now useCanvasInteractions does:

const p = getPoint(e); // screen coords
hitTestBoat(p.x, p.y, boat)

If the canvas is panned/zoomed, that breaks.

Fix: convert pointer to world first:

const pScreen = getPoint(e);
const p = screenToWorld(pScreen, cameraRef.current);

That’s it. Then boats/marks remain stored in world coords (best).

You’ll want a cameraRef in interactions just like your other refs, so pointer handlers don’t stale-close.

⸻

5) Avoid fighting object drag

Rules that match “normal whiteboard apps”:
	•	Space + drag = pan (desktop)
	•	Middle mouse drag = pan (desktop)
	•	Two-finger = pan/zoom (mobile)
	•	One-finger = interact with objects (mobile)

This hook respects that: pinch only starts when 2 touch pointers are down.

⸻

6) Optional polish you’ll probably want next
	•	Double click to reset zoom / center
	•	Fit-to-content / fit-to-start-line
	•	Trackpad pan: treat wheel as pan unless ctrlKey (common in browsers for pinch-zoom)
	•	Keep zoom within sensible range and maybe quantize zoom steps

⸻

Quick sanity checklist

When done:
	•	Wheel zoom stays centered on cursor ✅
	•	Space+drag pans smoothly ✅
	•	Boats/marks selection and dragging still works at any zoom ✅
	•	Touch pinch zoom doesn’t scroll the page ✅

⸻

If you paste your current useCanvasDraw + useCanvasInteractions signatures (or confirm where you want to store camera: SAB state vs inside the hooks), I’ll show the exact minimal diffs for those two files so it compiles first go.