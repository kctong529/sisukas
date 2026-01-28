// src/lib/transcript/importTranscript.ts
import { get } from "svelte/store";
import { favouritesStore } from "../stores/favouritesStore";
import { plansStore } from "../stores/plansStore";
import { courseIndexStore } from "../stores/courseIndexStore";
import { courseGradeStore } from "../stores/courseGradeStore";
import type { Course } from "../../domain/models/Course";

export type TranscriptGrade = "Pass" | "Fail" | "0" | "1" | "2" | "3" | "4" | "5" | string;

export type TranscriptRow = {
  code: string;
  name?: string;
  grade: TranscriptGrade;
  credits?: number;
  lang?: string;
  date: string; // e.g. "2 Dec 2025"
};

export type ImportTranscriptResult = {
  processed: number;
  addedFavourites: number;
  addedInstances: number;
  replacedInstances: number;
  updatedGrades: number;
  skipped: Array<{ row: TranscriptRow; reason: string }>;
};

function parseTranscriptDate(s: string): Date | null {
  // transcript uses "2 Dec 2025"
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Default here:
 * - "0".."5" => 0..5
 * - Pass/Fail/anything else => null (do not set a numeric grade)
 */
function toNumericGrade(g: TranscriptGrade): number | null {
  const raw = String(g).trim();
  if (/^[0-5]$/.test(raw)) return Number(raw);
  return null;
}

function isCodeFavourited(code: string): boolean {
  return get(favouritesStore).favourites.some((f) => f.courseId === code);
}

function courseCodeOf(c: Course): string {
  return String(c?.code?.value ?? c?.code ?? "").trim();
}

/**
 * Finds an instanceId inside the active plan whose resolved course has the same course code.
 */
function findPlanInstanceForCode(code: string): string | null {
  const plan = get(plansStore).activePlan;
  if (!plan) return null;

  for (const instanceId of plan.instanceIds) {
    const c = courseIndexStore.resolveByInstanceId(instanceId);
    if (!c) continue;
    if (courseCodeOf(c) === code) return instanceId;
  }
  return null;
}

async function ensureActivePlan(): Promise<void> {
  const plan = get(plansStore).activePlan;
  if (plan) return;

  await plansStore.load();

  const afterLoad = get(plansStore).activePlan;
  if (afterLoad) return;

  const plans = get(plansStore).plans;
  if (plans.length > 0) {
    await plansStore.setActive(plans[0].id);
    return;
  }

  const created = await plansStore.create("Default");
  await plansStore.setActive(created.id);
}

async function applyOne(
  row: TranscriptRow
): Promise<
  | {
      ok: true;
      addedFavourite: boolean;
      addedInstance: boolean;
      replacedInstance: boolean;
      updatedGrade: boolean;
    }
  | { ok: false; reason: string }
> {
  const date = parseTranscriptDate(row.date);
  if (!date) return { ok: false, reason: `Bad date: "${row.date}"` };

  const code = row.code.trim();
  if (!code) return { ok: false, reason: `Missing course code` };

  const course = courseIndexStore.resolveLatestInstanceByCodeBeforeDate(code, date);
  if (!course) {
    return {
      ok: false,
      reason: `No matching instance for code "${code}" on/before ${row.date}`,
    };
  }

  const unitId = course.unitId;  // still used for grades
  const instanceId = course.id;
  const numericGrade = toNumericGrade(row.grade);

  // 1) favourites: ensure code is favourited
  let addedFavourite = false;
  if (!isCodeFavourited(code)) {
    await favouritesStore.add(code);
    addedFavourite = true;
  }

  // 2) plans: ensure correct instance for this code is in active plan
  const plan = get(plansStore).activePlan;
  if (!plan) return { ok: false, reason: "No active plan" };

  const alreadyInPlan = plan.instanceIds.includes(instanceId);

  let addedInstance = false;
  let replacedInstance = false;

  if (!alreadyInPlan) {
    const otherInstanceId = findPlanInstanceForCode(code);
    if (otherInstanceId && otherInstanceId !== instanceId) {
      await plansStore.removeInstanceFromActivePlan(otherInstanceId);
      replacedInstance = true;
    }

    await plansStore.addInstanceToActivePlan(instanceId);
    addedInstance = true;
  }

  // 3) grades: upsert grade (unitId-keyed)
  let updatedGrade = false;
  if (numericGrade !== null) {
    await courseGradeStore.setGrade(unitId, numericGrade);
    updatedGrade = true;
  }

  return { ok: true, addedFavourite, addedInstance, replacedInstance, updatedGrade };
}

/**
 * Import transcript rows into:
 * - favourites (by unitId)
 * - active plan (instanceId; replaces other instance of same unitId)
 * - grade store (by unitId; numeric grades only by default)
 */
export async function importTranscript(rows: TranscriptRow[]): Promise<ImportTranscriptResult> {
  await ensureActivePlan();

  const result: ImportTranscriptResult = {
    processed: 0,
    addedFavourites: 0,
    addedInstances: 0,
    replacedInstances: 0,
    updatedGrades: 0,
    skipped: [],
  };

  // If transcript has duplicates, keep the latest row per (code, date) or (code) — your call.
  // Here: do it in given order (your extractor already de-dupes).
  for (const row of rows) {
    result.processed++;

    try {
      const r = await applyOne(row);
      if (!r.ok) {
        result.skipped.push({ row, reason: r.reason });
        continue;
      }

      if (r.addedFavourite) result.addedFavourites++;
      if (r.addedInstance) result.addedInstances++;
      if (r.replacedInstance) result.replacedInstances++;
      if (r.updatedGrade) result.updatedGrades++;
    } catch (e) {
      result.skipped.push({
        row,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return result;
}
