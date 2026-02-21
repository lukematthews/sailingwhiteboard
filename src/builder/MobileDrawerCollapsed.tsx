import React from "react";
import AudioScrubberBar from "../components/dopesheet/AudioScrubberBar";

export function MobileDrawerCollapsed(props: {
  timeMs: number;
  durationMs: number;
  isPlaying: boolean;
  playbackRate: number;
  setPlaybackRate: (r: number) => void;
  onScrubTo: (t: number) => void;
  onJumpStart: () => void;
  onTogglePlay: () => void;
  onJumpEnd: () => void;
}) {
  return (
    <div className="h-full px-2 pb-2">
      <AudioScrubberBar
        timeMs={props.timeMs}
        durationMs={props.durationMs}
        scrubberStep={50}
        onScrubTo={props.onScrubTo}
        onJumpStart={props.onJumpStart}
        onTogglePlay={props.onTogglePlay}
        onJumpEnd={props.onJumpEnd}
        isPlaying={props.isPlaying}
        playbackRate={props.playbackRate}
        setPlaybackRate={props.setPlaybackRate}
      />
    </div>
  );
}
