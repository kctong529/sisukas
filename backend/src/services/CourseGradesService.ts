// src/services/CourseGradesService.ts
import { db } from "../db";
import { courseGrades } from "../db/schema";
import { and, eq } from "drizzle-orm";

export class CourseGradesService {
  static async getGradesByUser(userId: string) {
    try {
      const rows = await db
        .select()
        .from(courseGrades)
        .where(eq(courseGrades.userId, userId));

      return rows;
    } catch (error) {
      console.error("Error fetching course grades:", error);
      throw new Error("Failed to fetch course grades from database");
    }
  }

  static async getGrade(userId: string, courseUnitId: string) {
    try {
      const [row] = await db
        .select()
        .from(courseGrades)
        .where(and(eq(courseGrades.userId, userId), eq(courseGrades.courseUnitId, courseUnitId)))
        .limit(1);

      return row ?? null;
    } catch (error) {
      console.error("Error fetching course grade:", error);
      throw error;
    }
  }

  static async exists(userId: string, courseUnitId: string): Promise<boolean> {
    try {
      const [row] = await db
        .select({ userId: courseGrades.userId })
        .from(courseGrades)
        .where(and(eq(courseGrades.userId, userId), eq(courseGrades.courseUnitId, courseUnitId)))
        .limit(1);

      return !!row;
    } catch (error) {
      console.error("Error checking course grade exists:", error);
      throw error;
    }
  }

  static async upsertGrade(data: { userId: string; courseUnitId: string; grade: number }) {
    try {
      // If it exists -> update; else -> insert.
      const existing = await this.getGrade(data.userId, data.courseUnitId);

      if (!existing) {
        const [created] = await db
          .insert(courseGrades)
          .values({
            userId: data.userId,
            courseUnitId: data.courseUnitId,
            grade: data.grade,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        if (!created) throw new Error("Failed to create grade");
        return created;
      }

      const [updated] = await db
        .update(courseGrades)
        .set({
          grade: data.grade,
          updatedAt: new Date(),
        })
        .where(and(eq(courseGrades.userId, data.userId), eq(courseGrades.courseUnitId, data.courseUnitId)))
        .returning();

      if (!updated) throw new Error("Failed to update grade");
      return updated;
    } catch (error) {
      console.error("Error upserting grade:", error);
      throw error;
    }
  }

  static async removeGrade(userId: string, courseUnitId: string) {
    try {
      const result = await db
        .delete(courseGrades)
        .where(and(eq(courseGrades.userId, userId), eq(courseGrades.courseUnitId, courseUnitId)))
        .returning({ userId: courseGrades.userId });

      return result.length > 0;
    } catch (error) {
      console.error("Error removing grade:", error);
      throw error;
    }
  }
}
