// src/builder/MobileTopBar.tsx
import React from "react";

type Props = {
  title?: string;
  onAddBoat: () => void;
  onOpenPanels: () => void;
};

export function MobileTopBar({
  title = "Sailing Whiteboard",
  onAddBoat,
  onOpenPanels,
}: Props) {
  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between rounded-2xl bg-white/90 backdrop-blur border border-slate-200 shadow-sm px-3 py-2">
        {/* Title */}
        <div className="text-sm font-semibold text-slate-900 truncate">
          {title}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            className="rounded-xl px-3 py-2 text-sm bg-white ring-1 ring-slate-200 active:scale-[0.99]"
            onClick={onAddBoat}
          >
            + Boat
          </button>

          <button
            className="rounded-xl px-3 py-2 text-sm bg-slate-900 text-white active:scale-[0.99]"
            onClick={onOpenPanels}
          >
            Panels
          </button>
        </div>
      </div>
    </div>
  );
}
