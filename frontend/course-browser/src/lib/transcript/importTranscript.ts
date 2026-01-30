// src/lib/transcript/importTranscript.ts
import { favouritesStore } from "../stores/favouritesStore";
import { plansStore } from "../stores/plansStore.svelte";
import { courseIndexStore } from "../stores/courseIndexStore.svelte";
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
  const activePlan = plansStore.read.getActive();
  if (activePlan) return;

  await plansStore.actions.ensureLoaded();

  const afterLoad = plansStore.read.getActive();
  if (afterLoad) return;

  const plans = plansStore.read.getAll();
  if (plans.length > 0) {
    await plansStore.actions.setActive(plans[0].id);
    return;
  }

  const created = await plansStore.actions.create("Default");
  await plansStore.actions.setActive(created.id);
}

export async function importTranscript(rows: TranscriptRow[]): Promise<ImportTranscriptResult> {
  await ensureActivePlan();

  // Ensure course index has historical loaded (needed for date-based resolution)
  await courseIndexStore.actions.ensureHistoricalLoaded().catch(() => {});

  // Ensure we have current local state before computing deltas
  if (plansStore.read.getAll().length === 0) {
    await plansStore.actions.ensureLoaded().catch(() => {});
  }

  const plan = plansStore.read.getActive();
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

  const existingFavouriteCodes = new Set<string>();
  const existingInstanceIds = new Set(plan.instanceIds);

  // Build mapping code -> current instanceId in plan (if any)
  const instanceInPlanByCode = new Map<string, string>();
  for (const instanceId of plan.instanceIds) {
    const c = courseIndexStore.read.resolveByInstanceId(instanceId);
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

    let course = courseIndexStore.read.resolveLatestInstanceByCodeBeforeDate(code, date);

    if (!course && !attemptedResolveCodes.has(code)) {
      attemptedResolveCodes.add(code);

      try {
        await CourseSnapshotsService.resolveAndStore(code);
      } catch {
        // ignore
      }

      // Ensure historical base is present before merging snapshots into it
      await courseIndexStore.actions.ensureHistoricalLoaded().catch(() => {});

      try {
        await SnapshotHistoricalMerge.mergeAllLiveSnapshots();
      } catch {
        // ignore
      }

      course = courseIndexStore.read.resolveLatestInstanceByCodeBeforeDate(code, date);
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

    if (!existingFavouriteCodes.has(code)) {
      favToAdd.push(code);
      existingFavouriteCodes.add(code);
    }

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

    if (numericGrade !== null) {
      gradesToUpsert.push({ courseUnitId: unitId, grade: numericGrade });
    }
  }

  const favouriteCourseIds = uniqNonEmpty(favToAdd);
  const addInstanceIds = uniqNonEmpty(instancesToAdd);
  const removeInstanceIds = uniqNonEmpty(instancesToRemove);

  const gradeByUnit = new Map<string, number>();
  for (const g of gradesToUpsert) gradeByUnit.set(g.courseUnitId, g.grade);
  const grades = Array.from(gradeByUnit.entries()).map(([courseUnitId, grade]) => ({
    courseUnitId,
    grade,
  }));

  const bulk = await transcriptService.importBulk({
    planId: plan.id,
    favouriteCourseIds,
    addInstanceIds,
    removeInstanceIds,
    grades,
  });

  result.addedFavourites = bulk.addedFavourites;
  result.addedInstances = bulk.addedInstances;
  result.updatedGrades = bulk.upsertedGrades;

  await Promise.allSettled([
    favouritesStore.load?.(),
    plansStore.actions.ensureLoaded(),
    courseGradeStore.load?.(),
  ]);

  return result;
}