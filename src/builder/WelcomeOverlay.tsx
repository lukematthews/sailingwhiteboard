import React, { useEffect, useMemo, useState } from "react";
import { SCENARIOS, type ScenarioDefinition, type ScenarioKey } from "./scenarios";
import { useIsMobile } from "./useIsMobile";
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

function ScenarioCard(p: {
  scenario: ScenarioDefinition;
  onPick: (key: ScenarioKey) => void;
  showRrsMeta?: boolean;
  ruleIndex: Map<string, { title?: string; ruleText?: string }>;
}) {
  const s = p.scenario;
  const rules = Array.isArray(s.rules) ? s.rules : [];
  const tags = Array.isArray(s.tags) ? s.tags : [];

  const difficultyBadge = s.difficulty
    ? s.difficulty.charAt(0).toUpperCase() + s.difficulty.slice(1)
    : undefined;

  return (
    <button
      type="button"
      onClick={() => p.onPick(s.key)}
      className="group w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-slate-300 hover:shadow transition active:scale-[0.995]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-slate-900">{s.title}</div>

            {s.badge ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                {s.badge}
              </span>
            ) : null}

            {difficultyBadge ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                {difficultyBadge}
              </span>
            ) : null}

            {p.showRrsMeta && rules.length ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                {rules.join(", ")}
              </span>
            ) : null}
          </div>

          {s.desc ? <div className="mt-1 text-[13px] text-slate-600">{s.desc}</div> : null}

          {p.showRrsMeta && s.decisionSummary ? (
            <div className="mt-2 text-[12px] text-slate-700">
              <span className="font-semibold">Decision:</span> {s.decisionSummary}
            </div>
          ) : null}

          {p.showRrsMeta && tags.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.slice(0, 6).map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-slate-200"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}

          {/* Rule text (collapsible) */}
          {p.showRrsMeta && rules.length ? (
            <div className="mt-3">
              <details
                className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200"
                onClick={(e) => e.stopPropagation()}
              >
                <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                  Rule text
                </summary>

                <div className="mt-2 space-y-3">
                  {rules.map((rid) => {
                    const info = p.ruleIndex.get(rid);
                    const title = info?.title ? ` — ${info.title}` : "";
                    const txt = (info?.ruleText ?? "").trim();

                    return (
                      <div key={rid} className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
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
                            Rule text not included yet. Paste the official wording into
                            <span className="font-mono"> rrsRules.json</span>.
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

        <div className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 group-hover:bg-slate-100">
          Open →
        </div>
      </div>
    </button>
  );
}

export function WelcomeOverlay(props: {
  open: boolean;
  onClose: () => void;
  onPickScenario: (key: ScenarioKey) => void;
  onDontShowAgainChange?: (v: boolean) => void;
  dontShowAgain?: boolean;
}) {
  const { open, onClose, onPickScenario, dontShowAgain, onDontShowAgainChange } =
    props;

  const isMobile = useIsMobile(900);

  // Lock background scroll while overlay is open
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const rulesIndex = useMemo(() => {
    const rr = rulesRaw as unknown as RrsRulesJson;
    const m = new Map<string, { title?: string; ruleText?: string }>();
    const list = Array.isArray(rr?.rules) ? rr.rules : [];
    for (const r of list) {
      if (!r || typeof r !== "object") continue;
      if (typeof (r as any).id !== "string") continue;
      m.set((r as any).id, {
        title: typeof (r as any).title === "string" ? (r as any).title : undefined,
        ruleText:
          typeof (r as any).ruleText === "string" ? (r as any).ruleText : undefined,
      });
    }
    return m;
  }, []);

  const scenariosAll = useMemo(() => {
    const list = SCENARIOS.filter((s) => !s.hidden);

    // keep “Recommended” at the top within each list
    const score = (s: ScenarioDefinition) => (s.badge === "Recommended" ? 0 : 1);
    return list.slice().sort((a, b) => score(a) - score(b));
  }, []);

  const quickStartScenarios = useMemo(
    () => scenariosAll.filter((s) => s.type !== "rrs"),
    [scenariosAll],
  );

  const rrsScenarios = useMemo(
    () => scenariosAll.filter((s) => s.type === "rrs"),
    [scenariosAll],
  );

  const [tab, setTab] = useState<"quick" | "rrs">("quick");
  const [q, setQ] = useState("");
  const [ruleFilter, setRuleFilter] = useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] =
    useState<ScenarioDefinition["difficulty"] | null>(null);

  // reset filters when leaving the RRS tab
  useEffect(() => {
    if (tab !== "rrs") {
      setQ("");
      setRuleFilter(null);
      setDifficultyFilter(null);
    }
  }, [tab]);

  const allRuleIds = useMemo(() => {
    const ids: string[] = [];
    for (const s of rrsScenarios) {
      if (Array.isArray(s.rules)) ids.push(...s.rules);
    }
    return uniqSorted(ids);
  }, [rrsScenarios]);

  const filteredRrs = useMemo(() => {
    const query = normalize(q);

    return rrsScenarios.filter((s) => {
      if (ruleFilter && !(s.rules || []).includes(ruleFilter)) return false;
      if (difficultyFilter && s.difficulty !== difficultyFilter) return false;

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
  }, [rrsScenarios, q, ruleFilter, difficultyFilter]);

  if (!open) return null;

  const HowItWorks = () => (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
        <div className="text-xs font-semibold text-slate-700">1) Navigate</div>
        <div className="mt-1 text-[13px] text-slate-600">
          One-finger pan. Two-finger pinch to zoom (like maps).
        </div>
      </div>

      <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
        <div className="text-xs font-semibold text-slate-700">2) Select</div>
        <div className="mt-1 text-[13px] text-slate-600">
          Double-tap boats or flags to select and edit.
        </div>
      </div>

      <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
        <div className="text-xs font-semibold text-slate-700">3) Move + Replay</div>
        <div className="mt-1 text-[13px] text-slate-600">
          Long-press an item to drag it. Add steps, then press play.
        </div>
      </div>
    </div>
  );

  const Header = () => (
    <div className="border-b border-slate-200 px-5 py-4 sm:px-6 sm:py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-lg font-semibold text-slate-900">
            Welcome to Sailing Whiteboard
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Load a scenario to start quickly — or browse the RRS library.
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 active:scale-[0.99]"
          aria-label="Close"
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTab("quick")}
          className={
            tab === "quick"
              ? "rounded-full bg-slate-900 px-3 py-1.5 text-sm text-white"
              : "rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200"
          }
        >
          Quick start
        </button>

        <button
          type="button"
          onClick={() => setTab("rrs")}
          className={
            tab === "rrs"
              ? "rounded-full bg-slate-900 px-3 py-1.5 text-sm text-white"
              : "rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200"
          }
        >
          RRS library
        </button>
      </div>
    </div>
  );

  const QuickStartBody = () => (
    <div className="px-5 py-4 sm:px-6 sm:py-5">
      <HowItWorks />

      <div className="mt-5">
        <div className="mb-2 text-sm font-semibold text-slate-900">
          Start with a scenario
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {quickStartScenarios.map((s) => (
            <ScenarioCard
              key={s.key}
              scenario={s}
              onPick={onPickScenario}
              ruleIndex={rulesIndex}
            />
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={!!dontShowAgain}
            onChange={(e) => onDontShowAgainChange?.(e.target.checked)}
          />
          Don’t show this again
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPickScenario("blank")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 active:scale-[0.99]"
          >
            Skip (blank)
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 active:scale-[0.99]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  const Chip = (p: {
    label: string;
    active: boolean;
    onClick: () => void;
    title?: string;
  }) => (
    <button
      type="button"
      onClick={p.onClick}
      title={p.title}
      className={
        p.active
          ? "rounded-full bg-slate-900 px-3 py-1.5 text-sm text-white"
          : "rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200"
      }
    >
      {p.label}
    </button>
  );

  const RrsBody = () => (
    <div className="px-5 py-4 sm:px-6 sm:py-5">
      <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
        <div className="text-sm font-semibold text-slate-900">Browse by rule</div>
        <div className="mt-1 text-[13px] text-slate-600">
          Search scenarios, filter by rule, and open one to start replaying.
        </div>

        <div className="mt-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search (e.g. 'inside overlap', 'RRS 18', 'zone')"
            className="w-full rounded-xl bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-200"
          />
        </div>

        <div className="mt-3 space-y-2">
          <div className="text-xs font-semibold text-slate-700">Difficulty</div>
          <div className="flex flex-wrap gap-2">
            <Chip
              label="All"
              active={!difficultyFilter}
              onClick={() => setDifficultyFilter(null)}
            />
            <Chip
              label="Basic"
              active={difficultyFilter === "basic"}
              onClick={() => setDifficultyFilter("basic")}
            />
            <Chip
              label="Intermediate"
              active={difficultyFilter === "intermediate"}
              onClick={() => setDifficultyFilter("intermediate")}
            />
            <Chip
              label="Advanced"
              active={difficultyFilter === "advanced"}
              onClick={() => setDifficultyFilter("advanced")}
            />
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="text-xs font-semibold text-slate-700">Rules</div>
          <div className="flex flex-wrap gap-2">
            <Chip
              label="All"
              active={!ruleFilter}
              onClick={() => setRuleFilter(null)}
            />
            {allRuleIds.map((rid) => (
              <Chip
                key={rid}
                label={rid}
                active={ruleFilter === rid}
                onClick={() => setRuleFilter((prev) => (prev === rid ? null : rid))}
                title={rulesIndex.get(rid)?.title}
              />
            ))}
          </div>
        </div>

        <div className="mt-3 text-[12px] text-slate-600">
          Showing <span className="font-semibold">{filteredRrs.length}</span> scenario(s).
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {filteredRrs.length ? (
          filteredRrs.map((s) => (
            <ScenarioCard
              key={s.key}
              scenario={s}
              onPick={onPickScenario}
              showRrsMeta
              ruleIndex={rulesIndex}
            />
          ))
        ) : (
          <div className="rounded-2xl bg-white p-4 text-sm text-slate-600 ring-1 ring-slate-200">
            No scenarios match that filter yet.
            <div className="mt-2 text-[12px] text-slate-500">
              Add entries to <span className="font-mono">scenarios.json</span> with
              <span className="font-mono"> type: "rrs"</span>.
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={() => onPickScenario("blank")}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 active:scale-[0.99]"
        >
          Blank canvas
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 active:scale-[0.99]"
        >
          Close
        </button>
      </div>
    </div>
  );

  const Body = () => (tab === "rrs" ? <RrsBody /> : <QuickStartBody />);

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50"
        onClick={onClose}
        role="button"
        tabIndex={-1}
      />

      {/* Panel */}
      {isMobile ? (
        <div
          className="absolute inset-0 flex items-end justify-center"
          style={{
            paddingBottom: "env(safe-area-inset-bottom)",
            paddingTop: "env(safe-area-inset-top)",
          }}
        >
          <div className="w-full max-w-none">
            <div className="mx-auto w-full rounded-t-3xl bg-white shadow-xl ring-1 ring-slate-200 overflow-hidden">
              {/* Handle bar */}
              <div className="h-10 flex items-center justify-center border-b border-slate-200">
                <div className="h-1.5 w-12 rounded-full bg-slate-300" />
              </div>

              {/* Scrollable content */}
              <div className="max-h-[85vh] overflow-auto">
                <Header />
                <Body />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-200">
            <Header />
            <div className="max-h-[80vh] overflow-auto">
              <Body />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
