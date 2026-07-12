import React, { useEffect, useMemo, useState } from "react";
import {
  SCENARIOS,
  type ScenarioDefinition,
  type ScenarioKey,
} from "./scenarios";
import { useIsMobile } from "./useIsMobile";
import rulesRaw from "./rrsRules.json";

type RrsRule = {
  id: string;
  title?: string;
  markdown?: string;
};

type RrsRulesSection = {
  key: string;
  title: string;
  rules: RrsRule[];
};

type RrsRulesPart = {
  key: string;
  title: string;
  rules?: RrsRule[]; // some parts may have direct rules
  sections?: RrsRulesSection[];
};

type RrsRulesJson = {
  schemaVersion: number;
  source?: { publisher?: string; edition?: string; notes?: string };
  parts: RrsRulesPart[];
};

function normalize(s: string) {
  return s.trim().toLowerCase();
}

/** Accept "10" or "RRS 10" etc, normalize to "10" */
function normalizeRuleId(raw: string) {
  const s = raw.trim();
  const m = /^rrs\s*(.+)$/i.exec(s);
  return (m ? m[1] : s).trim();
}

function ScenarioCard(p: {
  scenario: ScenarioDefinition;
  onPick: (key: ScenarioKey) => void;
  showRrsMeta?: boolean;
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
            <div className="text-sm font-semibold text-slate-900">
              {s.title}
            </div>

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

          {s.desc ? (
            <div className="mt-1 text-[13px] text-slate-600">{s.desc}</div>
          ) : null}

          {p.showRrsMeta && s.decisionSummary ? (
            <div className="mt-2 text-[12px] text-slate-700">
              <span className="font-semibold">Decision:</span>{" "}
              {s.decisionSummary}
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
        </div>

        <div className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 group-hover:bg-slate-100">
          Open →
        </div>
      </div>
    </button>
  );
}

function matchesRule(s: ScenarioDefinition, ruleId: string) {
  const canon = normalizeRuleId(ruleId);
  const rules = Array.isArray(s.rules) ? s.rules : [];
  return rules.some((r) => normalizeRuleId(String(r)) === canon);
}

function mdSnippet(md: string, maxChars = 320) {
  const t = md.replace(/\r\n/g, "\n").trim();
  if (t.length <= maxChars) return t;
  return t.slice(0, maxChars).trimEnd() + "…";
}

export function WelcomeOverlay(props: {
  open: boolean;
  onClose: () => void;
  onPickScenario: (key: ScenarioKey) => void;
  onDontShowAgainChange?: (v: boolean) => void;
  dontShowAgain?: boolean;
}) {
  const {
    open,
    onClose,
    onPickScenario,
    dontShowAgain,
    onDontShowAgainChange,
  } = props;

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

  const scenariosAll = useMemo(() => {
    const list = SCENARIOS.filter((s) => !s.hidden);
    const score = (s: ScenarioDefinition) =>
      s.badge === "Recommended" ? 0 : 1;
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

  const rrs = rulesRaw as unknown as RrsRulesJson;

  // Flatten the rules tree into a list, but preserve part/section grouping for UI.
  const rulesTree = useMemo(() => {
    const parts = Array.isArray(rrs?.parts) ? rrs.parts : [];
    return parts.map((p) => {
      const directRules = Array.isArray(p.rules) ? p.rules : [];
      const sections = Array.isArray(p.sections) ? p.sections : [];
      return {
        key: p.key,
        title: p.title,
        directRules,
        sections,
      };
    });
  }, [rrs]);

  const rulesIndex = useMemo(() => {
    const m = new Map<string, RrsRule>();

    for (const part of rulesTree) {
      for (const r of part.directRules) {
        const canon = normalizeRuleId(r.id);
        m.set(canon, r);
        m.set(`RRS ${canon}`, r);
      }
      for (const sec of part.sections) {
        for (const r of sec.rules) {
          const canon = normalizeRuleId(r.id);
          m.set(canon, r);
          m.set(`RRS ${canon}`, r);
        }
      }
    }

    return m;
  }, [rulesTree]);

  const [tab, setTab] = useState<"quick" | "rrs">("quick");

  // RRS browser state
  const [q, setQ] = useState("");
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);

  // reset RRS selection when leaving tab
  useEffect(() => {
    if (tab !== "rrs") {
      setQ("");
      setSelectedRuleId(null);
      setRuleModalOpen(false);
    }
  }, [tab]);

  const filteredRules = useMemo(() => {
    const query = normalize(q);
    if (!query) return null; // no filtering

    // We filter inside the tree: keep parts/sections that match.
    const partMatches: {
      partKey: string;
      partTitle: string;
      sections: { key: string; title: string; rules: RrsRule[] }[];
      directRules: RrsRule[];
    }[] = [];

    for (const p of rulesTree) {
      const directRules = (p.directRules || []).filter((r) => {
        const hay =
          `${r.id} ${r.title ?? ""} ${r.markdown ?? ""}`.toLowerCase();
        return hay.includes(query);
      });

      const sections = (p.sections || [])
        .map((s) => {
          const rules = (s.rules || []).filter((r) => {
            const hay =
              `${r.id} ${r.title ?? ""} ${r.markdown ?? ""}`.toLowerCase();
            return hay.includes(query);
          });
          return { key: s.key, title: s.title, rules };
        })
        .filter((s) => s.rules.length > 0);

      if (directRules.length || sections.length) {
        partMatches.push({
          partKey: p.key,
          partTitle: p.title,
          sections,
          directRules,
        });
      }
    }

    return partMatches;
  }, [rulesTree, q]);

  const selectedRule = useMemo(() => {
    if (!selectedRuleId) return null;
    const canon = normalizeRuleId(selectedRuleId);
    return (
      rulesIndex.get(selectedRuleId) ??
      rulesIndex.get(canon) ??
      rulesIndex.get(`RRS ${canon}`) ??
      null
    );
  }, [rulesIndex, selectedRuleId]);

  const scenariosForSelectedRule = useMemo(() => {
    if (!selectedRuleId) return [];
    const canon = normalizeRuleId(selectedRuleId);
    return rrsScenarios.filter((s) => matchesRule(s, canon));
  }, [rrsScenarios, selectedRuleId]);

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
        <div className="text-xs font-semibold text-slate-700">
          3) Move + Replay
        </div>
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
            <ScenarioCard key={s.key} scenario={s} onPick={onPickScenario} />
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

  const RuleRow = (p: { rule: RrsRule }) => {
    const rid = normalizeRuleId(p.rule.id);
    const hasScenarios = rrsScenarios.some((s) => matchesRule(s, rid));

    return (
      <button
        type="button"
        onClick={() => {
          setSelectedRuleId(rid);
          setRuleModalOpen(true);
        }}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-slate-900">
              RRS {rid} {p.rule.title ? `— ${p.rule.title}` : ""}
            </div>
            {p.rule.markdown ? (
              <div className="mt-1 text-[12px] text-slate-600 whitespace-pre-wrap">
                {mdSnippet(p.rule.markdown, 140)}
              </div>
            ) : null}
          </div>
          <div className="shrink-0 text-[11px] text-slate-600">
            {hasScenarios ? "Scenarios →" : "No scenarios"}
          </div>
        </div>
      </button>
    );
  };

  const RulesBrowser = () => {
    const tree = filteredRules ?? rulesTree;

    return (
      <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
        <div className="text-sm font-semibold text-slate-900">RRS rules</div>
        <div className="mt-1 text-[13px] text-slate-600">
          Browse Parts/Sections. Tap a rule to view details and scenarios.
        </div>

        <div className="mt-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search rules (e.g. 'mark-room', '18.1', 'zone')"
            className="w-full rounded-xl bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-200"
          />
        </div>

        <div className="mt-3 space-y-3">
          {tree.length ? (
            tree.map((p: any) => (
              <details
                key={p.key}
                className="rounded-2xl bg-white p-3 ring-1 ring-slate-200"
                open
              >
                <summary className="cursor-pointer select-none text-sm font-semibold text-slate-900">
                  {p.title}
                </summary>

                <div className="mt-3 space-y-2">
                  {Array.isArray(p.directRules) && p.directRules.length ? (
                    <div className="space-y-2">
                      {p.directRules.map((r: RrsRule) => (
                        <RuleRow key={r.id} rule={r} />
                      ))}
                    </div>
                  ) : null}

                  {Array.isArray(p.sections) && p.sections.length ? (
                    <div className="space-y-3">
                      {p.sections.map((s: any) => (
                        <details
                          key={s.key}
                          className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"
                          open
                        >
                          <summary className="cursor-pointer select-none text-[13px] font-semibold text-slate-800">
                            {s.title}
                          </summary>
                          <div className="mt-3 space-y-2">
                            {(s.rules || []).map((r: RrsRule) => (
                              <RuleRow key={r.id} rule={r} />
                            ))}
                          </div>
                        </details>
                      ))}
                    </div>
                  ) : null}
                </div>
              </details>
            ))
          ) : (
            <div className="rounded-2xl bg-white p-4 text-sm text-slate-600 ring-1 ring-slate-200">
              No rules match that search.
            </div>
          )}
        </div>
      </div>
    );
  };

  const RuleDetailModal = () => {
    if (!ruleModalOpen || !selectedRuleId) return null;

    const rid = normalizeRuleId(selectedRuleId);
    const r = selectedRule;

    return (
      <div className="fixed inset-0 z-[120]">
        <div
          className="absolute inset-0 bg-slate-900/50"
          onClick={() => setRuleModalOpen(false)}
          role="button"
          tabIndex={-1}
        />

        <div
          className="absolute inset-0 flex items-end justify-center sm:items-center p-3"
          style={{
            paddingBottom: "env(safe-area-inset-bottom)",
            paddingTop: "env(safe-area-inset-top)",
          }}
        >
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-200">
            {/* Sticky header */}
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">
                    RRS {rid} {r?.title ? `— ${r.title}` : ""}
                  </div>
                  <div className="mt-0.5 text-[12px] text-slate-600">
                    {scenariosForSelectedRule.length} scenario(s)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRuleModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 active:scale-[0.99]"
                  aria-label="Close rule"
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="max-h-[80vh] overflow-auto p-4 space-y-4">
              {/* Rule text */}
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="text-xs font-semibold text-slate-700">
                  Rule text (Markdown)
                </div>
                {r?.markdown ? (
                  <div className="mt-2 whitespace-pre-wrap text-[13px] text-slate-800">
                    {r.markdown}
                  </div>
                ) : (
                  <div className="mt-2 text-[13px] text-slate-600">
                    No markdown found for this rule in{" "}
                    <span className="font-mono">rrsRules.json</span>.
                  </div>
                )}
              </div>

              {/* Scenarios */}
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-900">
                  Scenarios for this rule
                </div>

                {scenariosForSelectedRule.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {scenariosForSelectedRule.map((s) => (
                      <ScenarioCard
                        key={s.key}
                        scenario={s}
                        onPick={(k) => {
                          setRuleModalOpen(false);
                          onPickScenario(k);
                        }}
                        showRrsMeta
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-white p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                    No scenarios yet for RRS {rid}.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setRuleModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 active:scale-[0.99]"
                >
                  Back to rules
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 active:scale-[0.99]"
                >
                  Close overlay
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const RrsBody = () => (
    <div className="px-5 py-4 sm:px-6 sm:py-5">
      <RulesBrowser />

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

      <RuleDetailModal />
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
