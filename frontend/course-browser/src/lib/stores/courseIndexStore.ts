import { writable, get } from 'svelte/store';
import { loadCoursesWithCache } from '../../infrastructure/loaders/RemoteCourseLoader';
import type { Course } from '../../domain/models/Course';

export interface CourseIndexState {
  byInstanceId: Map<string, Course>;          // instanceId (Course.id) -> Course
  instanceIdsByCode: Map<string, string[]>;   // code.value -> [instanceId...]
  loading: boolean;
  error: string | null;
}

function buildIndexes(courses: Course[]): Pick<CourseIndexState, 'byInstanceId' | 'instanceIdsByCode'> {
  const byInstanceId = new Map<string, Course>();
  const instanceIdsByCode = new Map<string, string[]>();

  for (const c of courses) {
    // Canonical: instanceId
    byInstanceId.set(c.id, c);

    // Secondary: code -> instanceIds
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
    loading: false,
    error: null
  });

  return {
    subscribe: store.subscribe,

    async load() {
      store.update(s => ({ ...s, loading: true, error: null }));
      try {
        const courses = await loadCoursesWithCache();
        const { byInstanceId, instanceIdsByCode } = buildIndexes(courses);

        store.set({
          byInstanceId,
          instanceIdsByCode,
          loading: false,
          error: null
        });

        return { byInstanceId, instanceIdsByCode };
      } catch (err) {
        store.set({
          byInstanceId: new Map(),
          instanceIdsByCode: new Map(),
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load courses'
        });
        throw err;
      }
    },

    setCourses(courses: Course[]) {
      const { byInstanceId, instanceIdsByCode } = buildIndexes(courses);
      store.set({ byInstanceId, instanceIdsByCode, loading: false, error: null });
      return { byInstanceId, instanceIdsByCode };
    },

    // ----- Read APIs (safe, no "get(this)" bugs) -----

    getByInstanceId(instanceId: string): Course | null {
      return get(store).byInstanceId.get(instanceId) ?? null;
    },

    getInstanceIdsByCode(code: string): string[] {
      return get(store).instanceIdsByCode.get(code) ?? [];
    },

    getInstancesByCode(code: string): Course[] {
      const state = get(store);
      const ids = state.instanceIdsByCode.get(code) ?? [];
      return ids.map((id) => state.byInstanceId.get(id)).filter(Boolean) as Course[];
    },

    isEmpty(): boolean {
      return get(store).byInstanceId.size === 0;
    }
  };
}

export const courseIndexStore = createCourseIndexStore();
