import React, { useMemo, useState } from "react";
import rrsRules from "./rrsRules.json";
import rrsScenarios from "./rrsScenarios.json";
import RuleDetailModal from "./RuleDetailModal";

export type RrsRule = {
  id: string;
  title: string;
  markdown: string;
};

export type Section = {
  key: string;
  title: string;
  rules: RrsRule[];
};

export type Part = {
  key: string;
  title: string;
  sections?: Section[];
  rules?: RrsRule[];
};

export type RrsScenario = {
  key: string;
  title: string;
  difficulty?: string;
  tags?: string[];
  rules: string[];
};

export type Props = {
  onLoadScenario: (key: string) => void;
};

export default function RrsLibraryPanel({ onLoadScenario }: Props) {
  const parts = (rrsRules as any).parts as Part[];
  const scenarios = (rrsScenarios as any).scenarios as RrsScenario[];

  const [query, setQuery] = useState("");
  const [activeRule, setActiveRule] = useState<{
    rule: RrsRule;
    partTitle: string;
    sectionTitle?: string;
  } | null>(null);

  const [collapsedParts, setCollapsedParts] = useState<Record<string, boolean>>(
    {},
  );
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});

  // -----------------------------------
  // Scenario count helper
  // -----------------------------------
  const scenarioCount = (ruleId: string) =>
    scenarios.filter((s) => s.rules.includes(ruleId)).length;

  // -----------------------------------
  // Filtered structure
  // -----------------------------------
  const filteredParts = useMemo(() => {
    if (!query.trim()) return parts;

    const q = query.toLowerCase();

    return parts
      .map((part) => {
        // Filter direct rules
        const directRules =
          part.rules?.filter(
            (r) =>
              r.id.toLowerCase().includes(q) ||
              r.title.toLowerCase().includes(q) ||
              r.markdown.toLowerCase().includes(q),
          ) || [];

        // Filter section rules
        const filteredSections =
          part.sections
            ?.map((section) => {
              const filteredRules = section.rules.filter(
                (r) =>
                  r.id.toLowerCase().includes(q) ||
                  r.title.toLowerCase().includes(q) ||
                  r.markdown.toLowerCase().includes(q),
              );

              if (filteredRules.length === 0) return null;

              return { ...section, rules: filteredRules };
            })
            .filter(Boolean) || [];

        if (directRules.length === 0 && filteredSections.length === 0) {
          return null;
        }

        return {
          ...part,
          rules: directRules,
          sections: filteredSections,
        };
      })
      .filter(Boolean) as Part[];
  }, [parts, query]);

  // -----------------------------------
  // Render
  // -----------------------------------
  return (
    <div style={styles.container}>
      <div style={styles.header}>RRS Library</div>

      <input
        style={styles.search}
        placeholder="Search rules..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div style={styles.ruleList}>
        {filteredParts.map((part) => {
          const partCollapsed = collapsedParts[part.key];

          return (
            <div key={part.key}>
              <div
                style={styles.partHeader}
                onClick={() =>
                  setCollapsedParts((prev) => ({
                    ...prev,
                    [part.key]: !prev[part.key],
                  }))
                }
              >
                {partCollapsed ? "▸" : "▾"} {part.title}
              </div>

              {!partCollapsed && (
                <>
                  {/* Direct rules */}
                  {part.rules?.map((rule) => (
                    <div
                      key={rule.id}
                      style={styles.ruleRow}
                      onClick={() =>
                        setActiveRule({
                          rule,
                          partTitle: part.title,
                        })
                      }
                    >
                      <span>
                        {rule.id} – {rule.title}
                      </span>
                      {scenarioCount(rule.id) > 0 && (
                        <span style={styles.badge}>
                          {scenarioCount(rule.id)}
                        </span>
                      )}
                    </div>
                  ))}

                  {/* Sections */}
                  {part.sections?.map((section) => {
                    const sectionKey = `${part.key}-${section.key}`;
                    const sectionCollapsed = collapsedSections[sectionKey];

                    return (
                      <div key={section.key} style={styles.sectionBlock}>
                        <div
                          style={styles.sectionHeader}
                          onClick={() =>
                            setCollapsedSections((prev) => ({
                              ...prev,
                              [sectionKey]: !prev[sectionKey],
                            }))
                          }
                        >
                          {sectionCollapsed ? "▸" : "▾"} {section.title}
                        </div>

                        {!sectionCollapsed &&
                          section.rules.map((rule) => (
                            <div
                              key={rule.id}
                              style={styles.ruleRow}
                              onClick={() =>
                                setActiveRule({
                                  rule,
                                  partTitle: part.title,
                                  sectionTitle: section.title,
                                })
                              }
                            >
                              <span>
                                {rule.id} – {rule.title}
                              </span>
                              {scenarioCount(rule.id) > 0 && (
                                <span style={styles.badge}>
                                  {scenarioCount(rule.id)}
                                </span>
                              )}
                            </div>
                          ))}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          );
        })}
      </div>

      {activeRule && (
        <RuleDetailModal
          rule={activeRule.rule}
          partTitle={activeRule.partTitle}
          sectionTitle={activeRule.sectionTitle}
          scenarios={scenarios.filter((s) =>
            s.rules.includes(activeRule.rule.id),
          )}
          onClose={() => setActiveRule(null)}
          onLoadScenario={(key) => {
            onLoadScenario(key);
            setActiveRule(null);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// STYLES
// ============================================================

export const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 12,
    fontSize: 14,
    display: "flex",
    flexDirection: "column",
    height: "100%",
  },

  header: {
    fontWeight: 600,
    marginBottom: 8,
  },

  search: {
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid #ddd",
    marginBottom: 10,
  },

  ruleList: {
    overflowY: "auto",
    flex: 1,
  },

  partHeader: {
    fontWeight: 600,
    marginTop: 8,
    cursor: "pointer",
  },

  sectionBlock: {
    paddingLeft: 12,
  },

  sectionHeader: {
    fontWeight: 500,
    marginTop: 6,
    cursor: "pointer",
  },

  ruleRow: {
    padding: "4px 0",
    paddingLeft: 12,
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
  },

  badge: {
    background: "#e5e7eb",
    borderRadius: 10,
    padding: "0px 6px",
    fontSize: 12,
    flexShrink: 0,
    height: 18,
    lineHeight: "18px",
  },

  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
  },

  // Modal as a flex column: sticky header + scroll body
  modal: {
    width: 720,
    maxWidth: "92vw",
    height: "85vh",
    background: "#fff",
    borderRadius: 12,
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },

  modalHeaderSticky: {
    position: "sticky",
    top: 0,
    zIndex: 2,
    background: "#fff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 20,
    borderBottom: "1px solid rgba(0,0,0,0.08)",
  },

  modalTitle: {
    fontWeight: 600,
    fontSize: 18,
  },

  modalMeta: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },

  closeBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    padding: 6,
    lineHeight: "16px",
  },

  modalBodyScroll: {
    padding: 20,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
  },

  ruleText: {
    marginBottom: 18,
    lineHeight: 1.5,
  },

  scenarioHeader: {
    fontWeight: 600,
    marginBottom: 10,
  },

  scenarioCard: {
    border: "1px solid #eee",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },

  scenarioTitle: {
    fontWeight: 500,
  },

  scenarioMeta: {
    fontSize: 12,
    opacity: 0.6,
    margin: "4px 0 8px",
  },

  loadBtn: {
    padding: "4px 8px",
    borderRadius: 6,
    border: "1px solid #ddd",
    cursor: "pointer",
    background: "#f9fafb",
  },
};
