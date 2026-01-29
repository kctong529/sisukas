// src/services/TranscriptService.ts
import { sql } from "drizzle-orm";
import { db } from "../db";

function uniqNonEmpty(xs: string[]): string[] {
  return Array.from(new Set(xs.map((s) => String(s ?? "").trim()).filter(Boolean)));
}

type BulkImportInput = {
  planId: string;
  favouriteCourseIds: string[];
  addInstanceIds: string[];
  removeInstanceIds: string[];
  grades: Array<{ courseUnitId: string; grade: number }>;
};

type BulkImportResult = {
  addedFavourites: number;
  removedInstances: number;
  addedInstances: number;
  upsertedGrades: number;
};

export class TranscriptService {
  static async importTranscriptBulk(userId: string, input: BulkImportInput): Promise<BulkImportResult> {
    const planId = input.planId;

    // ownership check
    const owns = await db.execute<{ ok: boolean }>(sql`
      select true as ok
      from public.plans
      where id = ${planId} and user_id = ${userId}
      limit 1
    `);
    if (!owns.rows?.[0]?.ok) {
      const err = new Error("Plan not found or not owned by user");
      (err as any).status = 404;
      throw err;
    }

    const favouriteCourseIds = uniqNonEmpty(input.favouriteCourseIds);
    const addInstanceIds = uniqNonEmpty(input.addInstanceIds);
    const removeInstanceIds = uniqNonEmpty(input.removeInstanceIds);

    const grades = input.grades
      .map((g) => ({
        courseUnitId: String(g?.courseUnitId ?? "").trim(),
        grade: Number(g?.grade),
      }))
      .filter((g) => g.courseUnitId && Number.isInteger(g.grade) && g.grade >= 0 && g.grade <= 5);

    const unitIds = grades.map((g) => g.courseUnitId);
    const vals = grades.map((g) => g.grade);

    return await db.transaction(async (tx) => {
      // 1) favourites: bulk insert-ignore
      let addedFavourites = 0;
      if (favouriteCourseIds.length > 0) {
        const r = await tx.execute(sql`
          insert into public.favourites (user_id, course_id)
          select ${userId}, x.course_id
          from unnest(
            ARRAY[${sql.join(favouriteCourseIds, sql`, `)}]::text[]
          ) as x(course_id)
          on conflict (user_id, course_id) do nothing
        `);
        addedFavourites = Number((r as any).rowCount ?? 0);
      }

      // 2) plan_instances: bulk delete
      let removedInstances = 0;
      if (removeInstanceIds.length > 0) {
        const r = await tx.execute(sql`
          delete from public.plan_instances
          where plan_id = ${planId}
            and instance_id = any(
              ARRAY[${sql.join(removeInstanceIds, sql`, `)}]::text[]
            )
        `);
        removedInstances = Number((r as any).rowCount ?? 0);
      }

      // 3) plan_instances: bulk insert-ignore
      let addedInstances = 0;
      if (addInstanceIds.length > 0) {
        const r = await tx.execute(sql`
          insert into public.plan_instances (plan_id, instance_id)
          select ${planId}, x.instance_id
          from unnest(
            ARRAY[${sql.join(addInstanceIds, sql`, `)}]::text[]
          ) as x(instance_id)
          on conflict (plan_id, instance_id) do nothing
        `);
        addedInstances = Number((r as any).rowCount ?? 0);
      }

      // 4) course_grades: bulk upsert
      let upsertedGrades = 0;
      if (unitIds.length > 0) {
        const r = await tx.execute(sql`
          insert into public.course_grades (user_id, course_unit_id, grade)
          select ${userId}, x.course_unit_id, x.grade
          from unnest(
            ARRAY[${sql.join(unitIds, sql`, `)}]::text[],
            ARRAY[${sql.join(vals, sql`, `)}]::int4[]
          ) as x(course_unit_id, grade)
          on conflict (user_id, course_unit_id) do update
          set grade = excluded.grade,
              updated_at = now()
        `);
        upsertedGrades = Number((r as any).rowCount ?? 0);
      }

      return { addedFavourites, removedInstances, addedInstances, upsertedGrades };
    });
  }
}
