// src/lib/stores/studyGroupStore.ts
import { writable, get } from "svelte/store";
import { StudyGroupService } from "../../infrastructure/services/StudyGroupService";
import type { StudyGroup } from "../../domain/models/StudyGroup";

interface StudyGroupStoreState {
  cache: { [key: string]: StudyGroup[] };
  loadingKeys: string[];
  error: string | null;
}

function createStudyGroupStore() {
  const { subscribe, update } = writable<StudyGroupStoreState>({
    cache: {},
    loadingKeys: [],
    error: null,
  });

  const service = new StudyGroupService(import.meta.env.VITE_WRAPPER_API);

  // Two queues: batch gets priority
  const hiQueue = new Map<string, { courseUnitId: string; courseOfferingId: string }>();
  const loQueue = new Map<string, { courseUnitId: string; courseOfferingId: string }>();

  let flushScheduled = false;

  const keyOf = (u: string, o: string) => `${u}:${o}`;

  const isCached = (key: string) => Boolean(get({ subscribe }).cache[key]);
  const isLoading = (key: string) => get({ subscribe }).loadingKeys.includes(key);

  function markLoading(keys: string[]) {
    if (keys.length === 0) return;
    update((s) => ({
      ...s,
      loadingKeys: Array.from(new Set([...s.loadingKeys, ...keys])),
    }));
  }

  function clearLoading(keys: string[]) {
    if (keys.length === 0) return;
    update((s) => ({
      ...s,
      loadingKeys: s.loadingKeys.filter((k) => !keys.includes(k)),
    }));
  }

  function scheduleFlush() {
    if (flushScheduled) return;
    flushScheduled = true;

    // next microtask: coalesce repeated calls in the same tick
    queueMicrotask(() => {
      flushScheduled = false;
      void flush();
    });
  }

  async function flush() {
    // Drain high priority first, then low.
    // Also: if hiQueue has anything, we do NOT do individual GETs at all.
    const toSend: Array<{ courseUnitId: string; courseOfferingId: string }> = [];
    const loadingKeys: string[] = [];

    const drainFrom = (q: typeof hiQueue | typeof loQueue) => {
      for (const [k, v] of q.entries()) {
        if (isCached(k) || isLoading(k)) {
          q.delete(k);
          continue;
        }
        toSend.push(v);
        loadingKeys.push(k);
        q.delete(k);
      }
    };

    drainFrom(hiQueue);
    // Only drain low queue if there is no high-priority work pending right now.
    if (toSend.length === 0) {
      drainFrom(loQueue);
    }

    if (toSend.length === 0) return;

    markLoading(loadingKeys);

    try {
      const results = await service.fetchStudyGroupsBatch(toSend, {
        chunkSize: 50,
        concurrency: 4,
      });

      update((s) => {
        const newCache = { ...s.cache };
        for (const [k, groups] of results.entries()) {
          newCache[k] = groups;
        }
        return { ...s, cache: newCache, error: null };
      });
    } catch (e) {
      update((s) => ({
        ...s,
        error: e instanceof Error ? e.message : "Batch fetch failed",
      }));
    } finally {
      clearLoading(loadingKeys);
    }

    // If new items were queued during the fetch, flush again.
    if (hiQueue.size > 0 || loQueue.size > 0) scheduleFlush();
  }

  function enqueueHigh(reqs: Array<{ courseUnitId: string; courseOfferingId: string }>) {
    for (const r of reqs) {
      const k = keyOf(r.courseUnitId, r.courseOfferingId);
      if (isCached(k) || isLoading(k)) continue;
      hiQueue.set(k, r);
    }
    scheduleFlush();
  }

  function enqueueLow(courseUnitId: string, courseOfferingId: string) {
    const k = keyOf(courseUnitId, courseOfferingId);
    if (isCached(k) || isLoading(k)) return;
    // Don't enqueue low if high already includes it
    if (!hiQueue.has(k)) loQueue.set(k, { courseUnitId, courseOfferingId });
    scheduleFlush();
  }

  return {
    subscribe,

    // "single" fetch becomes low-priority enqueue
    async fetch(courseUnitId: string, courseOfferingId: string): Promise<StudyGroup[]> {
      const key = keyOf(courseUnitId, courseOfferingId);
      const cached = get({ subscribe }).cache[key];
      if (cached) return cached;

      enqueueLow(courseUnitId, courseOfferingId);

      // caller expects a Promise<StudyGroup[]>; return cached if it appears,
      // otherwise just return [] quickly and let UI react to store update.
      // (If you prefer: you can implement a "wait until cached" helper.)
      return get({ subscribe }).cache[key] ?? [];
    },

    // high-priority enqueue
    async fetchBatch(requests: Array<{ courseUnitId: string; courseOfferingId: string }>): Promise<void> {
      enqueueHigh(requests);
    },

    isLoading(courseUnitId: string, courseOfferingId: string): boolean {
      return isLoading(keyOf(courseUnitId, courseOfferingId));
    },

    getCached(courseUnitId: string, courseOfferingId: string): StudyGroup[] | null {
      return get({ subscribe }).cache[keyOf(courseUnitId, courseOfferingId)] ?? null;
    },

    clear() {
      hiQueue.clear();
      loQueue.clear();
      update(() => ({ cache: {}, loadingKeys: [], error: null }));
    },
  };
}

export const studyGroupStore = createStudyGroupStore();
