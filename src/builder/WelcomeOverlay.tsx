import React, { useEffect } from "react";
import type { ScenarioKey as WelcomeScenarioKey } from "./scenarios";
import { useIsMobile } from "./useIsMobile";

export function WelcomeOverlay(props: {
  open: boolean;
  onClose: () => void;
  onPickScenario: (key: WelcomeScenarioKey) => void;
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

  if (!open) return null;

  const Card = (p: {
    title: string;
    desc: string;
    keyName: WelcomeScenarioKey;
    badge?: string;
  }) => (
    <button
      type="button"
      onClick={() => onPickScenario(p.keyName)}
      className="group w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-slate-300 hover:shadow transition active:scale-[0.995]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-slate-900">
              {p.title}
            </div>
            {p.badge ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                {p.badge}
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-[13px] text-slate-600">{p.desc}</div>
        </div>

        <div className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 group-hover:bg-slate-100">
          Open →
        </div>
      </div>
    </button>
  );

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
            Quickly replay and explain what happened on the water — set a
            course, place boats, add steps, and press play.
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
    </div>
  );

  const Body = () => (
    <div className="px-5 py-4 sm:px-6 sm:py-5">
      <HowItWorks />

      <div className="mt-5">
        <div className="mb-2 text-sm font-semibold text-slate-900">
          Start with a scenario
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Card
            keyName="start-sequence"
            title="Start Sequence"
            badge="Recommended"
            desc="Line setup + countdown flags. Practice timing and positioning."
          />
          <Card
            keyName="boat-interaction"
            title="Boat Interaction"
            desc="Overlap + give-way situations. Learn controls and rewinds."
          />
          <Card
            keyName="protest-replay"
            title="Protest Replay"
            desc="A structured replay example for protest room storytelling."
          />
          <Card
            keyName="blank"
            title="Blank Canvas"
            desc="Start from scratch with an empty scene."
          />
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
