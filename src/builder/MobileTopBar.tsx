export function MobileTopBar({
  onAddBoat,
  onOpenPanels,
}: {
  onAddBoat: () => void;
  onOpenPanels: () => void;
}) {
  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between rounded-2xl bg-white/90 backdrop-blur border border-slate-200 shadow-sm px-3 py-2">
        <div className="text-sm font-semibold text-slate-900">Sailing Whiteboard</div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-xl px-3 py-2 text-sm bg-white ring-1 ring-slate-200"
            onClick={onAddBoat}
          >
            + Boat
          </button>
          <button
            className="rounded-xl px-3 py-2 text-sm bg-slate-900 text-white"
            onClick={onOpenPanels}
          >
            Panels
          </button>
        </div>
      </div>
    </div>
  );
}