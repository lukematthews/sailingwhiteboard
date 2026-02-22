// src/builder/RrsLibraryPanel.tsx
import React, { useMemo, useState } from "react";
import { SCENARIOS, type ScenarioDefinition, type ScenarioKey } from "./scenarios";
import rulesRaw from "./rrsRules.json";

type RrsRulesJson = {
  schemaVersion: number;
  source?: { publisher?: string; edition?: string; notes?: string };
  rules: { id: string; title?: string; ruleText?: string }[];
};

function normalize(s: string) {
  return s.trim().toLowerCase();
}

function uniqSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

export default function RrsLibraryPanel(props: {
  onLoadScenario: (key: ScenarioKey) => void;
}) {
  const { onLoadScenario } = props;

  const rulesIndex = useMemo(() => {
    const rr = rulesRaw as unknown as RrsRulesJson;
    const m = new Map<string, { title?: string; ruleText?: string }>();
    for (const r of Array.isArray(rr?.rules) ? rr.rules : []) {
      if (!r?.id) continue;
      m.set(r.id, { title: r.title, ruleText: r.ruleText });
    }
    return m;
  }, []);

  const rrsScenarios = useMemo(
    () => SCENARIOS.filter((s) => !s.hidden && s.type === "rrs"),
    [],
  );

  const allRuleIds = useMemo(() => {
    const ids: string[] = [];
    for (const s of rrsScenarios) if (Array.isArray(s.rules)) ids.push(...s.rules);
    return uniqSorted(ids);
  }, [rrsScenarios]);

  const [q, setQ] = useState("");
  const [ruleFilter, setRuleFilter] = useState<string>("all");
  const [difficulty, setDifficulty] = useState<
    ScenarioDefinition["difficulty"] | "all"
  >("all");

  const filtered = useMemo(() => {
    const query = normalize(q);

    return rrsScenarios.filter((s) => {
      if (ruleFilter !== "all" && !(s.rules || []).includes(ruleFilter)) return false;
      if (difficulty !== "all" && s.difficulty !== difficulty) return false;

      if (!query) return true;

      const hay = [
        s.title,
        s.desc ?? "",
        s.decisionSummary ?? "",
        ...(s.rules ?? []),
        ...(s.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(query);
    });
  }, [rrsScenarios, q, ruleFilter, difficulty]);

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-slate-900">RRS Library</div>

      <div className="grid grid-cols-1 gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search rules, tags, scenarios…"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
        />

        <div className="grid grid-cols-2 gap-2">
          <select
            value={ruleFilter}
            onChange={(e) => setRuleFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All rules</option>
            {allRuleIds.map((id) => {
              const title = rulesIndex.get(id)?.title;
              return (
                <option key={id} value={id}>
                  {id}
                  {title ? ` — ${title}` : ""}
                </option>
              );
            })}
          </select>

          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as any)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All levels</option>
            <option value="basic">Basic</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            No scenarios match your filters yet.
          </div>
        ) : (
          filtered.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => onLoadScenario(s.key)}
              className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-slate-300 hover:shadow transition active:scale-[0.995]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-slate-900">
                      {s.title}
                    </div>

                    {s.difficulty ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                        {s.difficulty}
                      </span>
                    ) : null}

                    {Array.isArray(s.rules) && s.rules.length ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                        {s.rules.join(", ")}
                      </span>
                    ) : null}
                  </div>

                  {s.desc ? (
                    <div className="mt-1 text-[13px] text-slate-600">{s.desc}</div>
                  ) : null}

                  {s.decisionSummary ? (
                    <div className="mt-2 text-[12px] text-slate-700">
                      <span className="font-semibold">Decision:</span>{" "}
                      {s.decisionSummary}
                    </div>
                  ) : null}

                  {Array.isArray(s.rules) && s.rules.length ? (
                    <div className="mt-2">
                      <details
                        className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                          Rule text
                        </summary>

                        <div className="mt-2 space-y-3">
                          {s.rules.map((rid) => {
                            const info = rulesIndex.get(rid);
                            const title = info?.title ? ` — ${info.title}` : "";
                            const txt = (info?.ruleText ?? "").trim();

                            return (
                              <div
                                key={rid}
                                className="rounded-lg bg-white p-2 ring-1 ring-slate-200"
                              >
                                <div className="text-xs font-semibold text-slate-800">
                                  {rid}
                                  {title}
                                </div>
                                {txt ? (
                                  <div className="mt-1 whitespace-pre-wrap text-[12px] text-slate-700">
                                    {txt}
                                  </div>
                                ) : (
                                  <div className="mt-1 text-[12px] text-slate-500">
                                    Rule text not included yet. Paste the official wording
                                    into <span className="font-mono">rrsRules.json</span>.
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    </div>
                  ) : null}
                </div>

                <div className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700">
                  Load →
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}