// src/builder/RuleDetailModal.tsx

import React from "react";
import ReactMarkdown from "react-markdown";
import type { RrsRule, RrsScenario } from "./RrsLibraryPanel";
import { styles } from "./RrsLibraryPanel";

type Props = {
  rule: RrsRule;
  partTitle: string;
  sectionTitle?: string;
  scenarios: RrsScenario[];
  onClose: () => void;
  onLoadScenario: (key: string) => void;
};

export default function RuleDetailModal({
  rule,
  partTitle,
  sectionTitle,
  scenarios,
  onClose,
  onLoadScenario,
}: Props) {
  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Sticky header */}
        <div style={modalStyles.headerSticky}>
          <div>
            <div style={styles.modalTitle}>
              {rule.id} – {rule.title}
            </div>
            <div style={styles.modalMeta}>
              {partTitle}
              {sectionTitle && ` → ${sectionTitle}`}
            </div>
          </div>

          <button style={styles.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div style={modalStyles.bodyScroll}>
          <div style={styles.ruleText}>
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h1 style={md.h1}>{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 style={md.h2}>{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 style={md.h3}>{children}</h3>
                ),
                h4: ({ children }) => (
                  <h4 style={md.h4}>{children}</h4>
                ),
                p: ({ children }) => <p style={md.p}>{children}</p>,
                ul: ({ children }) => <ul style={md.ul}>{children}</ul>,
                ol: ({ children }) => <ol style={md.ol}>{children}</ol>,
                li: ({ children }) => <li style={md.li}>{children}</li>,
                strong: ({ children }) => (
                  <strong style={md.strong}>{children}</strong>
                ),
                em: ({ children }) => <em style={md.em}>{children}</em>,
                hr: () => <hr style={md.hr} />,
                blockquote: ({ children }) => (
                  <blockquote style={md.blockquote}>{children}</blockquote>
                ),
                code: ({ children }) => (
                  <code style={md.codeInline}>{children}</code>
                ),
              }}
            >
              {rule.markdown}
            </ReactMarkdown>
          </div>

          <div style={styles.scenarioHeader}>Scenarios</div>

          {scenarios.length === 0 && (
            <div style={{ opacity: 0.6 }}>No scenarios available yet.</div>
          )}

          {scenarios.map((s) => (
            <div key={s.key} style={styles.scenarioCard}>
              <div style={styles.scenarioTitle}>{s.title}</div>
              <div style={styles.scenarioMeta}>
                {s.difficulty || "—"}
                {s.tags && s.tags.length > 0 && <> • {s.tags.join(" • ")}</>}
              </div>
              <button
                style={styles.loadBtn}
                onClick={() => onLoadScenario(s.key)}
              >
                Load Scenario
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const modalStyles: Record<string, React.CSSProperties> = {
  headerSticky: {
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

  bodyScroll: {
    padding: 20,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
  },
};

// Markdown element styles (Tailwind resets headings, so we define them)
const md: Record<string, React.CSSProperties> = {
  h1: {
    fontSize: 22,
    fontWeight: 700,
    margin: "0 0 10px",
    lineHeight: 1.2,
  },
  h2: {
    fontSize: 18,
    fontWeight: 700,
    margin: "16px 0 8px",
    lineHeight: 1.25,
  },
  h3: {
    fontSize: 15,
    fontWeight: 700,
    margin: "14px 0 6px",
    lineHeight: 1.25,
  },
  h4: {
    fontSize: 13,
    fontWeight: 700,
    margin: "12px 0 6px",
    lineHeight: 1.25,
  },
  p: {
    margin: "8px 0",
    lineHeight: 1.55,
  },
  ul: {
    margin: "8px 0 8px 18px",
    padding: 0,
  },
  ol: {
    margin: "8px 0 8px 18px",
    padding: 0,
  },
  li: {
    margin: "4px 0",
  },
  strong: {
    fontWeight: 700,
  },
  em: {
    fontStyle: "italic",
  },
  hr: {
    border: "none",
    borderTop: "1px solid rgba(0,0,0,0.10)",
    margin: "14px 0",
  },
  blockquote: {
    margin: "10px 0",
    padding: "8px 10px",
    borderLeft: "3px solid rgba(0,0,0,0.18)",
    background: "rgba(0,0,0,0.03)",
  },
  codeInline: {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: 12,
    padding: "1px 6px",
    borderRadius: 6,
    background: "rgba(0,0,0,0.06)",
  },
};