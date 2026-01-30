// src/lib/transcript/importTranscript.ts
import { get } from "svelte/store";
import { favouritesStore } from "../stores/favouritesStore";
import { plansStore } from "../stores/plansStore";
import { courseIndexStore } from "../stores/courseIndexStore";
import { courseGradeStore } from "../stores/courseGradeStore";
import { transcriptService } from "../../infrastructure/services/TranscriptService";
import type { Course } from "../../domain/models/Course";
import { CourseSnapshotsService } from "../../infrastructure/services/CourseSnapshotsService";
import { SnapshotHistoricalMerge } from "../../infrastructure/loaders/SnapshotHistoricalMerge";

export type TranscriptGrade = "Pass" | "Fail" | "0" | "1" | "2" | "3" | "4" | "5" | string;

export type TranscriptRow = {
  code: string;
  name?: string;
  grade: TranscriptGrade;
  credits?: number;
  lang?: string;
  date: string;
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
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

function toNumericGrade(g: TranscriptGrade): number | null {
  const raw = String(g).trim();
  if (/^[0-5]$/.test(raw)) return Number(raw);
  return null;
}

function uniqNonEmpty(xs: string[]): string[] {
  return Array.from(new Set(xs.map((s) => String(s ?? "").trim()).filter(Boolean)));
}

function courseCodeOf(c: Course): string {
  return String((c as Course)?.code?.value ?? (c as Course)?.code ?? "").trim();
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

export async function importTranscript(rows: TranscriptRow[]): Promise<ImportTranscriptResult> {
  await ensureActivePlan();

  // Ensure we have current local state before computing deltas
  if (get(favouritesStore).favourites.length === 0) {
    await favouritesStore.load().catch(() => {});
  }
  if (!get(courseGradeStore).loadedOnce) {
    await courseGradeStore.load().catch(() => {});
  }
  if (!get(plansStore).activePlan) {
    await plansStore.load();
  }

  const plan = get(plansStore).activePlan;
  if (!plan) {
    return {
      processed: 0,
      addedFavourites: 0,
      addedInstances: 0,
      replacedInstances: 0,
      updatedGrades: 0,
      skipped: [{ row: rows[0] as TranscriptRow, reason: "No active plan" }],
    };
  }

  const existingFavouriteCodes = new Set(get(favouritesStore).favourites.map((f) => f.courseId));
  const existingInstanceIds = new Set(plan.instanceIds);

  // Build mapping code -> current instanceId in plan (if any)
  const instanceInPlanByCode = new Map<string, string>();
  for (const instanceId of plan.instanceIds) {
    const c = courseIndexStore.resolveByInstanceId(instanceId);
    if (!c) continue;
    const code = courseCodeOf(c);
    if (code) instanceInPlanByCode.set(code, instanceId);
  }

  const result: ImportTranscriptResult = {
    processed: 0,
    addedFavourites: 0,
    addedInstances: 0,
    replacedInstances: 0,
    updatedGrades: 0,
    skipped: [],
  };

  // Accumulate bulk ops
  const favToAdd: string[] = [];
  const instancesToAdd: string[] = [];
  const instancesToRemove: string[] = [];
  const gradesToUpsert: Array<{ courseUnitId: string; grade: number }> = [];
  const attemptedResolveCodes = new Set<string>();

  for (const row of rows) {
    result.processed++;

    const date = parseTranscriptDate(row.date);
    if (!date) {
      result.skipped.push({ row, reason: `Bad date: "${row.date}"` });
      continue;
    }

    const code = row.code.trim();
    if (!code) {
      result.skipped.push({ row, reason: "Missing course code" });
      continue;
    }

    let course = courseIndexStore.resolveLatestInstanceByCodeBeforeDate(code, date);

    if (!course && !attemptedResolveCodes.has(code)) {
      attemptedResolveCodes.add(code);

      // Best-effort: resolve/store snapshots for this code, then merge into memory
      try {
        await CourseSnapshotsService.resolveAndStore(code);
      } catch {
        // ignore: we still try merge + re-resolve (maybe snapshots already existed)
      }

      try {
        await SnapshotHistoricalMerge.mergeAllLiveSnapshots();
      } catch {
        // ignore: merge failure just means we won't see snapshots in memory
      }

      // Try again after merge
      course = courseIndexStore.resolveLatestInstanceByCodeBeforeDate(code, date);
    }

    if (!course) {
      result.skipped.push({
        row,
        reason: `No matching instance for code "${code}" on/before ${row.date}`,
      });
      continue;
    }


    const unitId = course.unitId;
    const targetInstanceId = course.id;
    const numericGrade = toNumericGrade(row.grade);

    // favourites: only add if not already favourited locally
    if (!existingFavouriteCodes.has(code)) {
      favToAdd.push(code);
      existingFavouriteCodes.add(code); // keep local set consistent for duplicates in transcript
    }

    // plan instances:
    // If plan already contains target instance, do nothing.
    // Else if plan contains another instance for same code, replace.
    if (!existingInstanceIds.has(targetInstanceId)) {
      const otherInstanceId = instanceInPlanByCode.get(code);
      if (otherInstanceId && otherInstanceId !== targetInstanceId) {
        instancesToRemove.push(otherInstanceId);
        existingInstanceIds.delete(otherInstanceId);
        result.replacedInstances++;
      }

      instancesToAdd.push(targetInstanceId);
      existingInstanceIds.add(targetInstanceId);
      instanceInPlanByCode.set(code, targetInstanceId);
    }

    // grades: only send numeric grades
    if (numericGrade !== null) {
      gradesToUpsert.push({ courseUnitId: unitId, grade: numericGrade });
    }
  }

  // De-dupe bulk lists (important if transcript contains duplicates)
  const favouriteCourseIds = uniqNonEmpty(favToAdd);
  const addInstanceIds = uniqNonEmpty(instancesToAdd);
  const removeInstanceIds = uniqNonEmpty(instancesToRemove);

  // De-dupe grades: keep last grade per unitId
  const gradeByUnit = new Map<string, number>();
  for (const g of gradesToUpsert) gradeByUnit.set(g.courseUnitId, g.grade);
  const grades = Array.from(gradeByUnit.entries()).map(([courseUnitId, grade]) => ({
    courseUnitId,
    grade,
  }));

  // Single backend call
  const bulk = await transcriptService.importBulk({
    planId: plan.id,
    favouriteCourseIds,
    addInstanceIds,
    removeInstanceIds,
    grades,
  });

  // Update counts from backend response (authoritative)
  result.addedFavourites = bulk.addedFavourites;
  result.addedInstances = bulk.addedInstances;
  result.updatedGrades = bulk.upsertedGrades;

  // replacedInstances is computed client-side (how many “swap” intentions we had)
  // backend doesn’t know “code”, only instance ids, so this is fine.

  // Refresh local stores once (avoid 100 tiny optimistic updates)
  await Promise.allSettled([
    favouritesStore.load(),
    plansStore.load(),
    courseGradeStore.load(),
  ]);

  return result;
}
