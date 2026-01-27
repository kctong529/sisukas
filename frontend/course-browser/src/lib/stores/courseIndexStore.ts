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

    isEmpty(): boolean {
      const s = get(store);
      return s.byInstanceId.size === 0 && s.historicalByInstanceId.size === 0;
    }
  };
}

export const courseIndexStore = createCourseIndexStore();
