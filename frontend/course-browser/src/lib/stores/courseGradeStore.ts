// src/lib/stores/courseGradeStore.ts
import { writable, get } from "svelte/store";
import { gradesService, type CourseGrade } from "../../infrastructure/services/GradesService";

export type CourseGradeMap = Map<string, number>;

interface CourseGradeStoreState {
  grades: CourseGradeMap;
  loading: boolean;
  error: string | null;
  loadedOnce: boolean;
}

function rowsToMap(rows: CourseGrade[]): CourseGradeMap {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.courseUnitId, r.grade);
  return m;
}

function createCourseGradeStore() {
  const initialState: CourseGradeStoreState = {
    grades: new Map(),
    loading: false,
    error: null,
    loadedOnce: false,
  };

  const { subscribe, set, update } = writable<CourseGradeStoreState>(initialState);

  return {
    subscribe,

    async load() {
      update((s) => ({ ...s, loading: true, error: null }));
      try {
        const rows = await gradesService.loadAll();
        update((s) => ({
          ...s,
          grades: rowsToMap(rows),
          loading: false,
          loadedOnce: true,
        }));
      } catch (err) {
        update((s) => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load grades",
        }));
        throw err;
      }
    },

    /**
     * Optimistic set. grade=null means delete.
     * Rolls back on API error.
     */
    async setGrade(courseUnitId: string, grade: number | null) {
      const state = get({ subscribe });
      const prev = state.grades.get(courseUnitId);

      // optimistic update
      update((s) => {
        const next = new Map(s.grades);
        if (grade === null) next.delete(courseUnitId);
        else next.set(courseUnitId, grade);
        return { ...s, grades: next, error: null };
      });

      try {
        if (grade === null) await gradesService.remove(courseUnitId);
        else await gradesService.upsert(courseUnitId, grade);
      } catch (err) {
        // rollback
        update((s) => {
          const next = new Map(s.grades);
          if (prev === undefined) next.delete(courseUnitId);
          else next.set(courseUnitId, prev);
          return {
            ...s,
            grades: next,
            error: err instanceof Error ? err.message : "Failed to save grade",
          };
        });
        throw err;
      }
    },

    getGrade(courseUnitId: string): number | undefined {
      return get({ subscribe }).grades.get(courseUnitId);
    },

    clear() {
      set(initialState);
    },
  };
}

export const courseGradeStore = createCourseGradeStore();
