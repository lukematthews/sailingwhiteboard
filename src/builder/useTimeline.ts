import { useCallback, useEffect, useRef, useState } from "react";
import { clamp } from "../lib/math";

export const DEFAULT_DURATION_MS = 12000;
export const DEFAULT_FPS = 60;

export function useTimeline() {
  const [durationMs, setDurationMs] = useState<number>(DEFAULT_DURATION_MS);
  const [fps, setFps] = useState<number>(DEFAULT_FPS);
  const [timeMs, setTimeMs] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);

  const playbackRateRef = useRef(playbackRate);
  useEffect(() => void (playbackRateRef.current = playbackRate), [playbackRate]);

  // animation loop
  useEffect(() => {
    if (!isPlaying) return;

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = now - last;
      last = now;

      const rate = playbackRateRef.current || 1;

      setTimeMs((t) => {
        const next = t + dt * rate;
        if (next >= durationMs) {
          setIsPlaying(false);
          return durationMs;
        }
        return next;
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, durationMs]);

  const stop = useCallback(() => setIsPlaying(false), []);
  const togglePlay = useCallback(() => setIsPlaying((p) => !p), []);
  const jumpToStart = useCallback(() => {
    setIsPlaying(false);
    setTimeMs(0);
  }, []);
  const jumpToEnd = useCallback(() => {
    setIsPlaying(false);
    setTimeMs(durationMs);
  }, [durationMs]);

  const setDurationSeconds = useCallback((s: number) => {
    const ms = clamp(s * 1000, 1000, 120000);
    setDurationMs(ms);
    setTimeMs((t) => clamp(t, 0, ms));
  }, []);

  return {
    durationMs,
    setDurationMs,
    setDurationSeconds,
    fps,
    setFps,
    timeMs,
    setTimeMs,
    isPlaying,
    setIsPlaying,
    playbackRate,
    setPlaybackRate,
    stop,
    togglePlay,
    jumpToStart,
    jumpToEnd,
  };
}