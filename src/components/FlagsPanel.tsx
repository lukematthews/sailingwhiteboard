import React from "react";
import type { Flag, FlagCode, FlagCodeClip, FlagClipsByFlagId } from "../types";
import { FLAG_LIBRARY } from "../types";
import { uid } from "../lib/ids";
import { clamp } from "../lib/math";

type FlagsPanelProps = {
  flags: Flag[];
  setFlags: React.Dispatch<React.SetStateAction<Flag[]>>;

  flagClipsByFlagId: FlagClipsByFlagId;
  setFlagClipsByFlagId: React.Dispatch<React.SetStateAction<FlagClipsByFlagId>>;

  selectedFlagId: string | null;
  setSelectedFlagId: (id: string | null) => void;

  timeMs: number;
  durationMs: number;
};

export default function FlagsPanel({
  flags,
  setFlags,
  flagClipsByFlagId,
  setFlagClipsByFlagId,
  selectedFlagId,
  setSelectedFlagId,
  timeMs,
  durationMs,
}: FlagsPanelProps) {
  const selected = selectedFlagId ? flags.find((f) => f.id === selectedFlagId) || null : null;
  const clips: FlagCodeClip[] = selectedFlagId ? flagClipsByFlagId[selectedFlagId] || [] : [];

  const addFlag = () => {
    const id = uid();
    setFlags((prev) => [...prev, { id, code: "P", x: 140, y: 120 + prev.length * 56 }]);
    setSelectedFlagId(id);
  };

  const deleteSelected = () => {
    if (!selectedFlagId) return;

    setFlags((prev) => prev.filter((f) => f.id !== selectedFlagId));

    setFlagClipsByFlagId((prev) => {
      const next = { ...prev };
      delete next[selectedFlagId];
      return next;
    });

    setSelectedFlagId(null);
  };

  const updateFlag = (patch: Partial<Flag>) => {
    if (!selectedFlagId) return;
    setFlags((prev) => prev.map((f) => (f.id === selectedFlagId ? { ...f, ...patch } : f)));
  };

  // When user changes the *default* flag.code, you may want to ALSO update all existing clips' codes.
  // This makes it feel like "this flag is a P flag" unless you explicitly change clip codes.
  const setDefaultCodeAndMaybeUpdateClips = (code: FlagCode) => {
    updateFlag({ code });

    // If you prefer NOT to auto-update clips, delete this block.
    setFlagClipsByFlagId((prev) => {
      if (!selectedFlagId) return prev;
      const list = prev[selectedFlagId] ? [...prev[selectedFlagId]] : [];
      if (list.length === 0) return prev;

      const next = list.map((c) => ({ ...c, code }));
      return { ...prev, [selectedFlagId]: next };
    });
  };

  const addClipAtTime = () => {
    if (!selectedFlagId || !selected) return;

    const startMs = Math.round(clamp(timeMs, 0, durationMs));
    const endMs = Math.round(clamp(startMs + 30000, 0, durationMs));

    const clip: FlagCodeClip = { id: uid(), startMs, endMs, code: selected.code };

    setFlagClipsByFlagId((prev) => {
      const list = prev[selectedFlagId] ? [...prev[selectedFlagId]] : [];
      list.push(clip);
      list.sort((a, b) => a.startMs - b.startMs);
      return { ...prev, [selectedFlagId]: list };
    });
  };

  const updateClip = (clipId: string, patch: Partial<FlagCodeClip>) => {
    if (!selectedFlagId) return;

    setFlagClipsByFlagId((prev) => {
      const list = prev[selectedFlagId] ? [...prev[selectedFlagId]] : [];
      const next = list
        .map((c) => (c.id === clipId ? { ...c, ...patch } : c))
        .map((c) => ({
          ...c,
          startMs: Math.round(clamp(c.startMs, 0, durationMs)),
          endMs: Math.round(clamp(c.endMs, 0, durationMs)),
        }))
        .map((c) => {
          // ensure start <= end
          if (c.endMs < c.startMs) return { ...c, endMs: c.startMs };
          return c;
        });

      next.sort((a, b) => a.startMs - b.startMs);
      return { ...prev, [selectedFlagId]: next };
    });
  };

  const deleteClip = (clipId: string) => {
    if (!selectedFlagId) return;

    setFlagClipsByFlagId((prev) => {
      const list = prev[selectedFlagId] ? [...prev[selectedFlagId]] : [];
      const next = list.filter((c) => c.id !== clipId);
      return { ...prev, [selectedFlagId]: next };
    });
  };

  return (
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-slate-700">Flags</div>
        <button
          className="rounded-lg bg-white px-2 py-1 text-xs shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
          onClick={addFlag}
        >
          + Flag
        </button>
      </div>

      <div className="mt-2 space-y-1">
        {flags.length === 0 ? (
          <div className="text-xs text-slate-500">No flags yet. Add one.</div>
        ) : (
          flags.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedFlagId(f.id)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm ring-1 ${
                f.id === selectedFlagId
                  ? "bg-white ring-slate-300"
                  : "bg-transparent ring-transparent hover:bg-white/60"
              }`}
            >
              <span className="truncate text-xs text-slate-700">⚑ {f.code}</span>
              <span className="text-[10px] text-slate-500">{f.id === selectedFlagId ? "selected" : ""}</span>
            </button>
          ))
        )}
      </div>

      <div className="mt-3 rounded-lg bg-white p-2 ring-1 ring-slate-200">
        {!selected ? (
          <div className="text-xs text-slate-600">Select a flag to edit. (Drag it on the canvas.)</div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-700">Selected</div>

            <label className="block">
              <div className="text-xs text-slate-600">Default code (used when no clips)</div>
              <select
                className="mt-1 w-full rounded-lg bg-white px-2 py-2 text-sm ring-1 ring-slate-200"
                value={selected.code}
                onChange={(e) => setDefaultCodeAndMaybeUpdateClips(e.target.value as FlagCode)}
              >
                {FLAG_LIBRARY.map((x) => (
                  <option key={x.code} value={x.code}>
                    {x.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <div className="text-xs text-slate-600">X</div>
                <input
                  className="mt-1 w-full rounded-lg bg-white px-2 py-2 text-sm ring-1 ring-slate-200"
                  type="number"
                  value={Math.round(selected.x)}
                  onChange={(e) => updateFlag({ x: Number(e.target.value) })}
                />
              </label>
              <label className="block">
                <div className="text-xs text-slate-600">Y</div>
                <input
                  className="mt-1 w-full rounded-lg bg-white px-2 py-2 text-sm ring-1 ring-slate-200"
                  type="number"
                  value={Math.round(selected.y)}
                  onChange={(e) => updateFlag({ y: Number(e.target.value) })}
                />
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="w-full rounded-lg bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
                onClick={addClipAtTime}
              >
                + Clip at playhead
              </button>
              <button
                className="rounded-lg bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
                onClick={deleteSelected}
              >
                Delete
              </button>
            </div>

            <div className="mt-2">
              <div className="text-xs font-medium text-slate-700">Clips (code over time)</div>

              {clips.length === 0 ? (
                <div className="mt-1 text-xs text-slate-500">
                  No clips — this flag will display its <span className="font-medium">default code</span> at all times.
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  {clips.map((c) => (
                    <div key={c.id} className="rounded-lg bg-slate-50 p-2 ring-1 ring-slate-200">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] font-medium text-slate-700">Clip</div>
                        <button
                          className="text-[11px] text-slate-600 hover:text-slate-900"
                          onClick={() => deleteClip(c.id)}
                        >
                          Delete
                        </button>
                      </div>

                      <label className="mt-2 block">
                        <div className="text-[11px] text-slate-600">Clip code</div>
                        <select
                          className="mt-1 w-full rounded-md bg-white px-2 py-1 text-xs ring-1 ring-slate-200"
                          value={c.code}
                          onChange={(e) => updateClip(c.id, { code: e.target.value as FlagCode })}
                        >
                          {FLAG_LIBRARY.map((x) => (
                            <option key={x.code} value={x.code}>
                              {x.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <label className="block">
                          <div className="text-[11px] text-slate-600">Start (s)</div>
                          <input
                            className="mt-1 w-full rounded-md bg-white px-2 py-1 text-xs ring-1 ring-slate-200"
                            type="number"
                            value={(c.startMs / 1000).toFixed(2)}
                            onChange={(e) =>
                              updateClip(c.id, {
                                startMs: Math.round(clamp(Number(e.target.value) * 1000, 0, durationMs)),
                              })
                            }
                          />
                        </label>

                        <label className="block">
                          <div className="text-[11px] text-slate-600">End (s)</div>
                          <input
                            className="mt-1 w-full rounded-md bg-white px-2 py-1 text-xs ring-1 ring-slate-200"
                            type="number"
                            value={(c.endMs / 1000).toFixed(2)}
                            onChange={(e) =>
                              updateClip(c.id, {
                                endMs: Math.round(clamp(Number(e.target.value) * 1000, 0, durationMs)),
                              })
                            }
                          />
                        </label>
                      </div>

                      <div className="mt-1 text-[11px] text-slate-500">
                        When clips exist, the flag shows the active clip’s <span className="font-medium">clip code</span>.
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}