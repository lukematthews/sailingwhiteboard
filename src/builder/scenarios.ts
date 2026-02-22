// src/builder/scenarios.ts
import type { ProjectFile } from "./projectTypes";
import type { ScenarioFile } from "./useProjectIO";
import raw from "./scenarios.json";

/**
 * Scenarios are data-driven.
 *
 * - The WelcomeOverlay reads titles/desc/badges from scenarios.json.
 * - Each scenario contains either:
 *    - a raw ProjectFile payload (legacy), OR
 *    - the ScenarioFile wrapper used by import/export (preferred).
 *
 * Keep this loader permissive so the scenario library can evolve without
 * needing code changes for every new key or pack.
 */

/**
 * Scenario keys are data-driven. Keep as `string`.
 */
export type ScenarioKey = string;

export type ScenarioDefinition = {
  key: ScenarioKey;
  title: string;
  desc?: string;
  badge?: string;
  hidden?: boolean;

  // Library metadata (optional / for RRS packs)
  type?: "rrs" | "demo" | "custom";
  difficulty?: "basic" | "intermediate" | "advanced";
  rules?: string[];
  tags?: string[];
  teachingPoints?: string[];
  decisionSummary?: string;

  // Payload: either a raw ProjectFile (legacy) or ScenarioFile (preferred)
  project?: ProjectFile;
  file?: ScenarioFile;
};

type ScenariosJson = {
  schemaVersion: number;
  scenarios: any[];
};

const parsed = raw as unknown as ScenariosJson;

function deepClone<T>(v: T): T {
  // ProjectFile is plain JSON data; this is enough and avoids accidental mutation.
  return JSON.parse(JSON.stringify(v)) as T;
}

function isDifficulty(v: unknown): v is NonNullable<ScenarioDefinition["difficulty"]> {
  return v === "basic" || v === "intermediate" || v === "advanced";
}

function isType(v: unknown): v is NonNullable<ScenarioDefinition["type"]> {
  return v === "rrs" || v === "demo" || v === "custom";
}

export const SCENARIOS: ScenarioDefinition[] = (() => {
  const list = Array.isArray(parsed?.scenarios) ? parsed.scenarios : [];
  const cleaned: ScenarioDefinition[] = [];

  for (const s of list) {
    if (!s || typeof s !== "object") continue;
    if (typeof (s as any).key !== "string") continue;

    cleaned.push({
      key: (s as any).key,
      title: typeof (s as any).title === "string" ? (s as any).title : (s as any).key,
      desc: typeof (s as any).desc === "string" ? (s as any).desc : undefined,
      badge: typeof (s as any).badge === "string" ? (s as any).badge : undefined,
      hidden: !!(s as any).hidden,

      type: isType((s as any).type) ? (s as any).type : undefined,
      difficulty: isDifficulty((s as any).difficulty) ? (s as any).difficulty : undefined,
      rules: Array.isArray((s as any).rules) ? ((s as any).rules as string[]) : undefined,
      tags: Array.isArray((s as any).tags) ? ((s as any).tags as string[]) : undefined,
      teachingPoints: Array.isArray((s as any).teachingPoints)
        ? ((s as any).teachingPoints as string[])
        : undefined,
      decisionSummary:
        typeof (s as any).decisionSummary === "string" ? (s as any).decisionSummary : undefined,

      file: (s as any).file as ScenarioFile | undefined,
      project: (s as any).project as ProjectFile | undefined,
    });
  }

  return cleaned;
})();

export const SCENARIO_KEYS: ScenarioKey[] = SCENARIOS.filter((s) => !s.hidden).map(
  (s) => s.key,
);

export function getScenarioByKey(key: ScenarioKey): ScenarioDefinition | undefined {
  return SCENARIOS.find((s) => s.key === key);
}

export function getScenarioProjectFile(key: ScenarioKey): ProjectFile {
  const s = getScenarioByKey(key);
  if (!s) {
    // fall back to blank if missing
    const blank = SCENARIOS.find((x) => x.key === "blank");
    return deepClone(blank?.file?.project ?? blank?.project ?? ({} as ProjectFile));
  }

  // Prefer ScenarioFile wrapper payload if present
  if (s.file?.project) return deepClone(s.file.project);
  return deepClone(s.project ?? ({} as ProjectFile));
}
