import React, { useMemo, useRef, useState } from "react";

export type DrawerState = "collapsed" | "peek" | "full";

/**
 * SNAP.collapsed must be tall enough to fit:
 * - handle bar (40px)
 * - AudioScrubberBar (~90-110px depending on layout)
 * - padding + safe area
 */
const SNAP = {
  collapsed: 160, // ✅ was 72 (too small to show scrubber)
  peek: 0.38, // viewport fraction
  full: 0.84, // viewport fraction
} as const;

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function MobileShell(props: {
  canvas: React.ReactNode;
  topBar: React.ReactNode;

  drawerCollapsed: React.ReactNode;
  drawerContent: React.ReactNode;

  drawerState?: DrawerState;
  setDrawerState?: (s: DrawerState) => void;
}) {
  const { canvas, topBar, drawerCollapsed, drawerContent } = props;

  const [internalState, setInternalState] = useState<DrawerState>("collapsed");
  const drawerState = props.drawerState ?? internalState;
  const setDrawerState = props.setDrawerState ?? setInternalState;

  const [dragPx, setDragPx] = useState<number | null>(null);
  const startRef = useRef<{ y: number; startHeight: number } | null>(null);

  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  const snapHeights = useMemo(() => {
    return {
      collapsed: SNAP.collapsed,
      peek: Math.round(vh * SNAP.peek),
      full: Math.round(vh * SNAP.full),
    };
  }, [vh]);

  const currentHeight =
    dragPx ??
    (drawerState === "collapsed"
      ? snapHeights.collapsed
      : drawerState === "peek"
        ? snapHeights.peek
        : snapHeights.full);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    startRef.current = { y: e.clientY, startHeight: currentHeight };
    setDragPx(currentHeight);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!startRef.current) return;
    const dy = startRef.current.y - e.clientY; // drag up increases height
    const next = clamp(
      startRef.current.startHeight + dy,
      snapHeights.collapsed,
      snapHeights.full,
    );
    setDragPx(next);
  };

  const onPointerUp = () => {
    if (dragPx == null) return;

    const dCollapsed = Math.abs(dragPx - snapHeights.collapsed);
    const dPeek = Math.abs(dragPx - snapHeights.peek);
    const dFull = Math.abs(dragPx - snapHeights.full);

    const next: DrawerState =
      dCollapsed <= dPeek && dCollapsed <= dFull
        ? "collapsed"
        : dPeek <= dFull
          ? "peek"
          : "full";

    setDrawerState(next);
    setDragPx(null);
    startRef.current = null;
  };

  return (
    <div className="fixed inset-0 bg-white overflow-hidden">
      {/* Canvas layer */}
      <div className="absolute inset-0">{canvas}</div>

      {/* Top bar */}
      <div
        className="absolute left-0 right-0 top-0 z-20"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {topBar}
      </div>

      {/* Bottom drawer */}
      <div
        className="absolute left-0 right-0 bottom-0 z-30"
        style={{ height: currentHeight, paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="h-full rounded-t-2xl bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.12)] border-t border-slate-200 overflow-hidden flex flex-col">
          {/* Drag handle */}
          <div
            className="h-10 flex items-center justify-center touch-none shrink-0"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div className="h-1.5 w-12 rounded-full bg-slate-300" />
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-hidden">
            {drawerState === "collapsed" ? drawerCollapsed : drawerContent}
          </div>
        </div>
      </div>
    </div>
  );
}