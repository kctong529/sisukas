// src/domain/services/CourseCodeGuard.ts
import { courseIndexStore } from "../../lib/stores/courseIndexStore.svelte";

export function assertCourseCodeIsMissingEverywhere(raw: string): { ok: true; code: string } | { ok: false; message: string } {
  const code = raw.trim().toUpperCase();
  if (!code) return { ok: false, message: "courseCode is required" };

  if (courseIndexStore.read.getInstanceIdsByCode(code).length > 0) {
    return { ok: false, message: `${code} already exists in active dataset` };
  }
  if (courseIndexStore.read.getHistoricalInstanceIdsByCode(code).length > 0) {
    return { ok: false, message: `${code} already exists in historical dataset` };
  }
  return { ok: true, code };
}
