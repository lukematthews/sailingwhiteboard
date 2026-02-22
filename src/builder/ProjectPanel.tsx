// src/builder/ProjectPanel.tsx
import React, { useMemo, useState } from "react";

type Props = {
  exportText: string;
  setExportText: (t: string) => void;

  onExportScenario: () => void;
  onImportScenario: (text?: string) => void;

  fileBaseName?: string; // optional
};

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ProjectPanel({
  exportText,
  setExportText,
  onExportScenario,
  onImportScenario,
  fileBaseName = "sailing-whiteboard-scenario",
}: Props) {
  const [isEditing, setIsEditing] = useState(false);

  const hasJson = useMemo(() => exportText.trim().length > 0, [exportText]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
    } catch {
      // ignore
    }
  };

  const onDownload = () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadText(`${fileBaseName}-${stamp}.json`, exportText);
  };

  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-sm font-semibold text-slate-900">Project</h2>
      <p className="mt-1 text-xs text-slate-600">
        Export/import scenarios as JSON. Read-only by default to avoid
        accidental edits.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white active:scale-[0.99]"
          onClick={onExportScenario}
        >
          Export scenario
        </button>

        <button
          className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200 active:scale-[0.99] disabled:opacity-50"
          onClick={onCopy}
          disabled={!hasJson}
          title={!hasJson ? "Nothing to copy yet" : "Copy JSON to clipboard"}
        >
          Copy
        </button>

        <button
          className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200 active:scale-[0.99] disabled:opacity-50"
          onClick={onDownload}
          disabled={!hasJson}
          title={!hasJson ? "Nothing to download yet" : "Download .json"}
        >
          Download
        </button>

        <div className="flex-1" />

        <button
          className={[
            "rounded-xl px-3 py-2 text-sm active:scale-[0.99] ring-1",
            isEditing
              ? "bg-amber-50 text-amber-900 ring-amber-200"
              : "bg-white text-slate-900 ring-slate-200",
          ].join(" ")}
          onClick={() => setIsEditing((v) => !v)}
          title="Toggle editing"
        >
          {isEditing ? "Editing" : "Edit JSON"}
        </button>

        <button
          className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200 active:scale-[0.99] disabled:opacity-50"
          onClick={() => onImportScenario(exportText)}
          disabled={!isEditing || !hasJson}
          title={
            !isEditing
              ? "Enable Edit JSON to import"
              : !hasJson
                ? "Paste JSON first"
                : "Load scenario from this JSON"
          }
        >
          Import / Load
        </button>
      </div>

      <div className="mt-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <div className="text-xs font-medium text-slate-700">Scenario JSON</div>
        <textarea
          className={[
            "mt-2 h-60 w-full resize-none rounded-lg p-2 text-xs ring-1",
            isEditing
              ? "bg-white text-slate-900 ring-slate-200"
              : "bg-slate-100 text-slate-600 ring-slate-200",
          ].join(" ")}
          value={exportText}
          onChange={(e) => setExportText(e.target.value)}
          readOnly={!isEditing}
          placeholder="Click Export scenario to generate JSON…"
        />

        <div className="mt-2 text-[11px] text-slate-500">
          Tip: keep timing edits in the Dopesheet; scenarios are a portable
          wrapper for the whole setup.
        </div>
      </div>
    </div>
  );
}
