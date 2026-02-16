import { snapTime } from "../../lib/time";
import { Step } from "../../types";
import StepTrack from "./StepTrack";

export function FocusedBoatLane(props: {
  laneSteps: Step[];
  selectedStepId: string | null;

  timeMs: number;
  fps: number;
  durationMs: number;
  stepMs: number;

  ripple: boolean;

  onSelectStep: (stepId: string) => void;
  onDeleteStep: (stepId: string) => void;

  onMoveStep: (stepId: string, newTimeMs: number) => void;
}) {
  const {
    laneSteps,
    selectedStepId,
    timeMs,
    fps,
    durationMs,
    stepMs,
    ripple,
    onSelectStep,
    onDeleteStep,
    onMoveStep,
  } = props;

  return (
    <div className="min-w-0 space-y-3">
      {laneSteps.length === 0 ? (
        <div className="text-sm text-slate-500">No steps yet.</div>
      ) : (
        <StepTrack
          steps={laneSteps}
          durationMs={durationMs}
          timeMs={snapTime(timeMs, fps)}
          stepMs={stepMs}
          minGapMs={stepMs}
          ripple={ripple}
          selectedStepId={selectedStepId}
          onSelectStep={onSelectStep}
          onMoveStep={onMoveStep}
          onDeleteStep={onDeleteStep}
        />
      )}
    </div>
  );
}