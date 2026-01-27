// src/lib/stores/courseIndexStore.ts
import { writable, get } from 'svelte/store';
import { loadCoursesWithCache, loadHistoricalCoursesWithCache } from '../../infrastructure/loaders/RemoteCourseLoader';
import type { Course } from '../../domain/models/Course';

export interface CourseIndexState {
  // Active (courses.json)
  byInstanceId: Map<string, Course>;          // instanceId (Course.id) -> Course
  instanceIdsByCode: Map<string, string[]>;   // code.value -> [instanceId...]
  // Historical (historical.json)
  historicalByInstanceId: Map<string, Course>;
  historicalInstanceIdsByCode: Map<string, string[]>;
  loading: boolean;
  error: string | null;
}

function buildIndexes(courses: Course[]): {
  byInstanceId: Map<string, Course>;
  instanceIdsByCode: Map<string, string[]>;
} {
  const byInstanceId = new Map<string, Course>();
  const instanceIdsByCode = new Map<string, string[]>();

  for (const c of courses) {
    byInstanceId.set(c.id, c);

    const code = c.code.value;
    const arr = instanceIdsByCode.get(code);
    if (arr) arr.push(c.id);
    else instanceIdsByCode.set(code, [c.id]);
  }

  return { byInstanceId, instanceIdsByCode };
}

function createCourseIndexStore() {
  const store = writable<CourseIndexState>({
    byInstanceId: new Map(),
    instanceIdsByCode: new Map(),
    historicalByInstanceId: new Map(),
    historicalInstanceIdsByCode: new Map(),
    loading: false,
    error: null
  });

  return {
    subscribe: store.subscribe,

    async load() {
      store.update(s => ({ ...s, loading: true, error: null }));
      try {
        const [activeCourses, historicalCourses] = await Promise.all([
          loadCoursesWithCache(),
          loadHistoricalCoursesWithCache()
        ]);

        const active = buildIndexes(activeCourses);
        const historical = buildIndexes(historicalCourses); 

        store.set({
          byInstanceId: active.byInstanceId,
          instanceIdsByCode: active.instanceIdsByCode,
          historicalByInstanceId: historical.byInstanceId,
          historicalInstanceIdsByCode: historical.instanceIdsByCode,
          loading: false,
          error: null
        });

        return {
          byInstanceId: active.byInstanceId,
          instanceIdsByCode: active.instanceIdsByCode,
          historicalByInstanceId: historical.byInstanceId,
          historicalInstanceIdsByCode: historical.instanceIdsByCode
        };
      } catch (err) {
        store.set({
          byInstanceId: new Map(),
          instanceIdsByCode: new Map(),
          historicalByInstanceId: new Map(),
          historicalInstanceIdsByCode: new Map(),
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load courses'
        });
        throw err;
      }
    },

    // ----- Setters -----

    setCourses(courses: Course[]) {
      const { byInstanceId, instanceIdsByCode } = buildIndexes(courses);
      store.update(s => ({
        ...s,
        byInstanceId,
        instanceIdsByCode,
        loading: false,
        error: null
      }));
      return { byInstanceId, instanceIdsByCode };
    },

    setHistoricalCourses(courses: Course[]) {
      const { byInstanceId, instanceIdsByCode } = buildIndexes(courses);
      store.update(s => ({
        ...s,
        historicalByInstanceId: byInstanceId,
        historicalInstanceIdsByCode: instanceIdsByCode,
        loading: false,
        error: null
      }));
      return { historicalByInstanceId: byInstanceId, historicalInstanceIdsByCode: instanceIdsByCode };
    },

    // ----- Read APIs -----

    /** Active only */
    getByInstanceId(instanceId: string): Course | null {
      return get(store).byInstanceId.get(instanceId) ?? null;
    },

    /** Historical only */
    getHistoricalByInstanceId(instanceId: string): Course | null {
      return get(store).historicalByInstanceId.get(instanceId) ?? null;
    },

    /** Try active first; if missing, fall back to historical */
    resolveByInstanceId(instanceId: string): Course | null {
      const state = get(store);
      return state.byInstanceId.get(instanceId)
        ?? state.historicalByInstanceId.get(instanceId)
        ?? null;
    },

    /** For debugging and analytics */
    resolveByInstanceIdWithSource(instanceId: string): { course: Course; source: 'active' | 'historical' } | null {
      const state = get(store);

      const active = state.byInstanceId.get(instanceId);
      if (active) return { course: active, source: 'active' };

      const hist = state.historicalByInstanceId.get(instanceId);
      if (hist) return { course: hist, source: 'historical' };

      return null;
    },

    getInstanceIdsByCode(code: string): string[] {
      return get(store).instanceIdsByCode.get(code) ?? [];
    },

    getHistoricalInstanceIdsByCode(code: string): string[] {
      return get(store).historicalInstanceIdsByCode.get(code) ?? [];
    },

    getInstancesByCode(code: string): Course[] {
      const state = get(store);
      const ids = state.instanceIdsByCode.get(code) ?? [];
      return ids.map((id) => state.byInstanceId.get(id)).filter(Boolean) as Course[];
    },

    getHistoricalInstancesByCode(code: string): Course[] {
      const state = get(store);
      const ids = state.historicalInstanceIdsByCode.get(code) ?? [];
      return ids.map((id) => state.historicalByInstanceId.get(id)).filter(Boolean) as Course[];
    },

    /**
     * Resolve the most relevant course instance for a given course code that starts
     * on or before the given date.
     *
     * Preference is given to lecture instances whose end date falls within ±2 months
     * of the provided date. If no such lecture exists, the latest instance of any
     * format (e.g. exam) that starts on or before the date is returned.
     *
     * Returns null if no matching instance exists.
     */
    resolveLatestInstanceByCodeBeforeDate(code: string, beforeOrOn: Date): Course | null {
      const state = get(store);
      const cutoffMs = beforeOrOn.getTime();

      // ± 2 months window around beforeOrOn, used ONLY for the preferred lecture selection
      const windowStart = new Date(beforeOrOn);
      windowStart.setMonth(windowStart.getMonth() - 2);
      const windowEnd = new Date(beforeOrOn);
      windowEnd.setMonth(windowEnd.getMonth() + 2);

      const windowStartMs = windowStart.getTime();
      const windowEndMs = windowEnd.getTime();

      const ids = new Set<string>([
        ...(state.instanceIdsByCode.get(code) ?? []),
        ...(state.historicalInstanceIdsByCode.get(code) ?? []),
      ]);

      let bestPreferred: Course | null = null; // lecture + end within window + start <= cutoff
      let bestFallback: Course | null = null;  // any format, original criteria (start <= cutoff)

      for (const id of ids) {
        const c = state.byInstanceId.get(id) ?? state.historicalByInstanceId.get(id);
        if (!c) continue;

        const startMs = c.courseDate.start.getTime();
        if (startMs > cutoffMs) continue; // keep your original "beforeOrOn" rule

        // Fallback candidate: latest by start date
        if (!bestFallback || startMs > bestFallback.courseDate.start.getTime()) {
          bestFallback = c;
        }

        // Preferred candidate: lecture whose *end* is within ±2 months of beforeOrOn
        if (c.format === "lecture") {
          const endMs = c.courseDate.end.getTime();
          const endInWindow = endMs >= windowStartMs && endMs <= windowEndMs;
          if (endInWindow) {
            if (!bestPreferred || startMs > bestPreferred.courseDate.start.getTime()) {
              bestPreferred = c;
            }
          }
        }
      }

      return bestPreferred ?? bestFallback;
    },

    isEmpty(): boolean {
      const s = get(store);
      return s.byInstanceId.size === 0 && s.historicalByInstanceId.size === 0;
    }
  };
}

export const courseIndexStore = createCourseIndexStore();
