// src/builder/useTimeline.ts
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

export function useTimeline() {
  const [durationMs, setDurationMs] = useState(60000);
  const [fps, setFps] = useState(60);

  const [timeMs, setTimeMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const [playbackRate, setPlaybackRate] = useState(1);

  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);

  useEffect(() => {
    if (!isPlaying) return;

    const tick = (now: number) => {
      if (!lastRef.current) lastRef.current = now;

      const dt = now - lastRef.current;
      lastRef.current = now;

      // Force a DOM commit each frame (prevents “updates only when stopped”)
      flushSync(() => {
        setTimeMs((prev) => {
          const next = prev + dt * playbackRate;
          return Math.min(durationMs, next);
        });
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastRef.current = 0;
    };
  }, [isPlaying, playbackRate, durationMs]);

  // Auto-stop at end (keep this)
  useEffect(() => {
    if (timeMs >= durationMs && isPlaying) {
      setIsPlaying(false);
    }
  }, [timeMs, durationMs, isPlaying]);

  return {
    durationMs,
    setDurationMs,
    fps,
    setFps,
    timeMs,
    setTimeMs,
    isPlaying,
    setIsPlaying,
    playbackRate,
    setPlaybackRate,
  };
}
