import React, { useMemo, useState } from "react";

type Key = "steps" | "inspector" | "course" | "flags" | "timeline";

export function MobileDrawerTabs(props: {
  steps: React.ReactNode;
  inspector: React.ReactNode;
  course: React.ReactNode;
  flags: React.ReactNode;
  timeline: React.ReactNode;
  defaultTab?: Key;
}) {
  const { steps, inspector, course, flags, timeline } = props;
  const [tab, setTab] = useState<Key>(props.defaultTab ?? "steps");

  const tabs = useMemo(
    () =>
      [
        ["steps", "Steps"],
        ["inspector", "Inspect"],
        ["course", "Course"],
        ["flags", "Flags"],
        ["timeline", "Time"],
      ] as const,
    [],
  );

  const content =
    tab === "steps"
      ? steps
      : tab === "inspector"
        ? inspector
        : tab === "course"
          ? course
          : tab === "flags"
            ? flags
            : timeline;

  return (
    <div className="h-full flex flex-col">
      <div className="px-2 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {tabs.map(([k, label]) => (
            <button
              key={k}
              className={[
                "shrink-0 rounded-full px-3 py-2 text-sm border active:scale-[0.99]",
                tab === k
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-900 border-slate-200",
              ].join(" ")}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">{content}</div>
    </div>
  );
}
