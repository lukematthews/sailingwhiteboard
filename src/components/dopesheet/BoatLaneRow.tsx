import { Slider } from "antd";
import { formatTime, snapTime } from "../../lib/time";
import { Boat, Step } from "../../types";

export default function BoatLaneRow(props: {
  boat: Boat;
  laneSteps: Step[];
  selectedBoatId: string | null;
  selectedStepId: string | null;

  timeMs: number;
  fps: number;
  durationMs: number;
  stepMs: number;

  onSelectBoat: (boatId: string) => void;
  onSelectStep: (boatId: string, stepId: string) => void;
  onDeleteStep: (boatId: string, stepId: string) => void;
  onAddStepAtPlayhead: (boatId: string) => void;

  sliderValues: number[];
  onLaneSliderChange: (boatId: string, v: number | number[]) => void;
}) {
  const {
    boat,
    laneSteps,
    selectedBoatId,
    selectedStepId,
    timeMs,
    fps,
    durationMs,
    stepMs,
    onSelectBoat,
    onSelectStep,
    onDeleteStep,
    onAddStepAtPlayhead,
    sliderValues,
    onLaneSliderChange,
  } = props;

  const isBoatSelected = selectedBoatId === boat.id;

  return (
    <div className="col-span-3 border-b border-slate-200 last:border-b-0">
      <div className="grid grid-cols-[140px_minmax(0,1fr)_88px] items-start">
        {/* left */}
        <div className="px-2 py-3">
          <button
            className={`rounded-lg px-2 py-1 text-xs ring-1 ${
              isBoatSelected
                ? "bg-slate-900 text-white ring-slate-900"
                : "bg-slate-50 text-slate-800 ring-slate-200 hover:bg-slate-100"
            }`}
            onClick={() => onSelectBoat(boat.id)}
            type="button"
          >
            {boat.label}
          </button>
        </div>

        {/* middle */}
        <div className="px-2 py-3 min-w-0">
          <div className="grid grid-rows-[32px_36px] gap-1 min-w-0">
            <div className="min-w-0 flex items-center gap-1 overflow-x-auto whitespace-nowrap">
              {laneSteps.length === 0 ? (
                <div className="text-[11px] text-slate-500">No steps yet</div>
              ) : (
                laneSteps.map((s, i) => {
                  const isSelected = s.id === selectedStepId;
                  const isAtPlayhead =
                    Math.abs(s.tMs - snapTime(timeMs, fps)) < 1;

                  return (
                    <div
                      key={s.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectStep(boat.id, s.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectStep(boat.id, s.id);
                        }
                      }}
                      className={`group relative shrink-0 rounded-md px-2 py-1 text-[11px] ring-1 cursor-pointer select-none ${
                        isSelected
                          ? "bg-slate-900 text-white ring-slate-900"
                          : isAtPlayhead
                            ? "bg-emerald-50 text-emerald-900 ring-emerald-200 hover:bg-emerald-100"
                            : "bg-slate-50 text-slate-800 ring-slate-200 hover:bg-slate-100"
                      }`}
                      title={`Step ${i + 1} @ ${formatTime(s.tMs)}`}
                    >
                      {i + 1}
                      <span className="ml-1 text-[10px] opacity-60">
                        {formatTime(s.tMs)}
                      </span>

                      <button
                        className={`absolute -right-1 -top-1 h-4 w-4 items-center justify-center rounded bg-white text-[10px] text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 ${isSelected ? "flex" : "hidden"} group-hover:flex`}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onDeleteStep(boat.id, s.id);
                        }}
                        title="Delete step"
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Lane slider with FIXED endpoints */}
            <div className="min-w-0">
              <Slider
                className="steps-lane-slider w-full"
                style={{ width: "100%", maxWidth: "none" }}
                range
                min={0}
                max={Math.max(1, durationMs)}
                step={stepMs}
                value={sliderValues}
                onChange={(v) => onLaneSliderChange(boat.id, v as any)}
                onChangeComplete={(v) => onLaneSliderChange(boat.id, v as any)}
                tooltip={{
                  formatter: (v) =>
                    typeof v === "number" ? formatTime(v) : "",
                }}
              />
            </div>
          </div>
        </div>

        {/* right */}
        <div className="px-2 py-3">
          <div className="flex justify-end">
            <button
              className="h-8 rounded-lg bg-slate-50 px-2 text-xs ring-1 ring-slate-200 hover:bg-slate-100"
              onClick={() => onAddStepAtPlayhead(boat.id)}
              type="button"
            >
              + Step
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
