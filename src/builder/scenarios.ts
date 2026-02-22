// src/builder/scenarios.ts
import type { ProjectFile } from "./projectTypes";
import type { ScenarioFile } from "./useProjectIO";
import raw from "./scenarios.json";
import rawRrs from "./rrsScenarios.json";

/**
 * Scenarios are data-driven.
 *
 * - The WelcomeOverlay reads titles/desc/badges from scenarios JSON.
 * - Each scenario contains either:
 *    - a raw ProjectFile payload (legacy), OR
 *    - the ScenarioFile wrapper used by import/export (preferred).
 *
 * We load from multiple JSON files so the RRS pack can evolve independently
 * without constantly editing a huge scenarios.json.
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
const parsedRrs = rawRrs as unknown as ScenariosJson;

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function isDifficulty(
  v: unknown,
): v is NonNullable<ScenarioDefinition["difficulty"]> {
  return v === "basic" || v === "intermediate" || v === "advanced";
}

function isType(v: unknown): v is NonNullable<ScenarioDefinition["type"]> {
  return v === "rrs" || v === "demo" || v === "custom";
}

function coerceScenario(s: any): ScenarioDefinition | null {
  if (!s || typeof s !== "object") return null;
  if (typeof s.key !== "string") return null;

  return {
    key: s.key,
    title: typeof s.title === "string" ? s.title : s.key,
    desc: typeof s.desc === "string" ? s.desc : undefined,
    badge: typeof s.badge === "string" ? s.badge : undefined,
    hidden: !!s.hidden,

    type: isType(s.type) ? s.type : undefined,
    difficulty: isDifficulty(s.difficulty) ? s.difficulty : undefined,
    rules: Array.isArray(s.rules) ? (s.rules as string[]) : undefined,
    tags: Array.isArray(s.tags) ? (s.tags as string[]) : undefined,
    teachingPoints: Array.isArray(s.teachingPoints)
      ? (s.teachingPoints as string[])
      : undefined,
    decisionSummary:
      typeof s.decisionSummary === "string" ? s.decisionSummary : undefined,

    file: s.file as ScenarioFile | undefined,
    project: s.project as ProjectFile | undefined,
  };
}

export const SCENARIOS: ScenarioDefinition[] = (() => {
  const merged = [
    ...(Array.isArray(parsed?.scenarios) ? parsed.scenarios : []),
    ...(Array.isArray(parsedRrs?.scenarios) ? parsedRrs.scenarios : []),
  ];

  const cleaned: ScenarioDefinition[] = [];
  const seen = new Set<string>();

  for (const s of merged) {
    const c = coerceScenario(s);
    if (!c) continue;
    if (seen.has(c.key)) continue; // avoid accidental duplicates
    seen.add(c.key);
    cleaned.push(c);
  }

  return cleaned;
})();

export const SCENARIO_KEYS: ScenarioKey[] = SCENARIOS.filter(
  (s) => !s.hidden,
).map((s) => s.key);

export function getScenarioByKey(
  key: ScenarioKey,
): ScenarioDefinition | undefined {
  return SCENARIOS.find((s) => s.key === key);
}

export function getScenarioProjectFile(key: ScenarioKey): ProjectFile {
  const s = getScenarioByKey(key);
  if (!s) {
    const blank = SCENARIOS.find((x) => x.key === "blank");
    return deepClone(
      blank?.file?.project ?? blank?.project ?? ({} as ProjectFile),
    );
  }

  if (s.file?.project) return deepClone(s.file.project);
  return deepClone(s.project ?? ({} as ProjectFile));
}
