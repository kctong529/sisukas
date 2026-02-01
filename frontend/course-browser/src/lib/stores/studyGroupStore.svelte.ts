// src/lib/stores/studyGroupStore.svelte.ts
import { StudyGroupService } from "../../infrastructure/services/StudyGroupService";
import type { StudyGroup } from "../../domain/models/StudyGroup";
import { formatSchedulePattern } from "../studyGroups/studyGroupFormatters";

const LS_PREFIX = "sisukas:studyGroups:v1";

// TTL: 1 day for localStorage cache
const TTL_MS = 1000 * 60 * 60 * 24;

const lastRefreshAt = new Map<string, number>();
const REFRESH_COOLDOWN_MS = 1000 * 60 * 30; // 30 minutes

export type StudyGroupSummary = {
  groupId: string;
  name: string;
  type: string;
  schedule: string;
  eventCount: number;
};

export interface StudyGroupStoreState {
  // Single source of truth for full study group data
  cache: Record<string, StudyGroup[] | undefined>;

  // In-memory summaries (derived from full data when it arrives)
  summaryCache: Record<string, StudyGroupSummary[]>;

  // Fallback only: localStorage summaries for first-ever load/offline
  fallbackSummaries: Record<string, StudyGroupSummary[]>;

  loadingKeys: string[];
  error: string | null;

  // Keys with cached data but stale (background refresh active)
  staleKeys: Set<string>;
}

type CachedEntry = { fetchedAt: number; groups: StudyGroupSummary[] };

function lsKey(k: string) {
  return `${LS_PREFIX}:${k}`;
}

function saveToLocalStorage(k: string, groups: StudyGroupSummary[]) {
  try {
    if (typeof window === "undefined") return;
    const entry: CachedEntry = { fetchedAt: Date.now(), groups };
    localStorage.setItem(lsKey(k), JSON.stringify(entry));
  } catch (err) {
    console.warn("localStorage write failed:", err);
  }
}

function loadFromLocalStorage(k: string): StudyGroupSummary[] | null {
  try {
    if (typeof window === "undefined") return null;

    const raw = localStorage.getItem(lsKey(k));
    if (!raw) return null;

    const entry = JSON.parse(raw) as CachedEntry;
    if (!entry?.groups || typeof entry.fetchedAt !== "number") return null;

    const ageMs = Date.now() - entry.fetchedAt;
    if (ageMs > TTL_MS) {
      localStorage.removeItem(lsKey(k));
      return null;
    }

    return entry.groups;
  } catch (err) {
    console.error(`[toSummaries] Error loading local storage:`, err);
    return null;
  }
}

/**
 * Convert full StudyGroup objects to summaries.
 * Centralized here to ensure consistency across the store.
 */
function toSummaries(groups: StudyGroup[]): StudyGroupSummary[] {
  return groups.map((g) => {
    try {
      const schedule = formatSchedulePattern(g.studyEvents ?? []);
      return {
        groupId: g.groupId,
        name: g.name,
        type: g.type,
        schedule,
        eventCount: g.studyEvents?.length ?? 0,
      };
    } catch (err) {
      console.error(`[toSummaries] Error processing group ${g.groupId}:`, err);
      return {
        groupId: g.groupId,
        name: g.name,
        type: g.type,
        schedule: "Error processing schedule",
        eventCount: g.studyEvents?.length ?? 0,
      };
    }
  });
}

/**
 * Derive summaries from cache, falling back gracefully.
 * Priority: full data → summary cache → fallback summaries
 */
function deriveSummaries(key: string, s: StudyGroupStoreState): StudyGroupSummary[] {
  const fullData = s.cache[key];
  if (fullData !== undefined) return toSummaries(fullData);
  if (s.summaryCache[key]) return s.summaryCache[key];
  return s.fallbackSummaries[key] ?? [];
}

// --------------------------------------------
// Runes store
// --------------------------------------------

const service = new StudyGroupService(import.meta.env.VITE_WRAPPER_API);

// Two queues: batch gets priority
const hiQueue = new Map<string, { courseUnitId: string; courseOfferingId: string }>();
const loQueue = new Map<string, { courseUnitId: string; courseOfferingId: string }>();

let flushScheduled = false;

const keyOf = (u: string, o: string) => `${u}:${o}`;

export const studyGroupStore = (() => {
  const state = $state<StudyGroupStoreState>({
    cache: {},
    summaryCache: {},
    fallbackSummaries: {},
    loadingKeys: [],
    error: null,
    staleKeys: new Set(),
  });

  // -------------------------
  // Internal helpers
  // -------------------------

  const hasFullKey = (k: string) => state.cache[k] !== undefined;
  const isLoadingKey = (k: string) => state.loadingKeys.includes(k);
  const isStaleKey = (k: string) => state.staleKeys.has(k);

  function markLoading(keys: string[]) {
    if (keys.length === 0) return;
    state.loadingKeys = Array.from(new Set([...state.loadingKeys, ...keys]));
  }

  function clearLoading(keys: string[]) {
    if (keys.length === 0) return;
    const toRemove = new Set(keys);
    state.loadingKeys = state.loadingKeys.filter((k) => !toRemove.has(k));
  }

  function markStale(keys: string[]) {
    if (keys.length === 0) return;
    // ensure a new Set reference (reactivity)
    const next = new Set(state.staleKeys);
    for (const k of keys) next.add(k);
    state.staleKeys = next;
  }

  function clearStale(keys: string[]) {
    if (keys.length === 0) return;
    const next = new Set(state.staleKeys);
    for (const k of keys) next.delete(k);
    state.staleKeys = next;
  }

  function scheduleFlush() {
    if (flushScheduled) return;
    flushScheduled = true;

    // One flush per frame-ish
    window.setTimeout(() => {
      flushScheduled = false;
      void flush();
    }, 16);
  }

  async function flush() {
    const toSend: Array<{ courseUnitId: string; courseOfferingId: string }> = [];
    const loadingKeys: string[] = [];

    const drainFrom = (q: typeof hiQueue | typeof loQueue) => {
      for (const [k, v] of q.entries()) {
        // If it's stale, we always want to send it to get fresh data.
        if (!isStaleKey(k) && (hasFullKey(k) || isLoadingKey(k))) {
          q.delete(k);
          continue;
        }
        toSend.push(v);
        loadingKeys.push(k);
        q.delete(k);
      }
    };

    drainFrom(hiQueue);
    if (toSend.length === 0) drainFrom(loQueue);
    if (toSend.length === 0) return;

    markLoading(loadingKeys);

    try {
      await service.fetchStudyGroupsBatch(toSend, {
        chunkSize: 20,
        concurrency: 4,
        onChunk: (partial) => {
          const keys = Array.from(partial.keys());

          // Mutate state in-place (runes)
          for (const [k, groups] of partial.entries()) {
            state.cache = { ...state.cache, [k]: groups };

            const summaries = toSummaries(groups);
            state.summaryCache = { ...state.summaryCache, [k]: summaries };
            state.fallbackSummaries = { ...state.fallbackSummaries, [k]: summaries };

            saveToLocalStorage(k, summaries);
          }

          state.error = null;

          // Clear markers as chunks arrive
          clearLoading(keys);
          clearStale(keys);
        },
      });
    } catch (e) {
      state.error = e instanceof Error ? e.message : "Batch fetch failed";
      clearLoading(loadingKeys);
      clearStale(loadingKeys);
    }

    if (hiQueue.size > 0 || loQueue.size > 0) scheduleFlush();
  }

  function enqueueHigh(
    reqs: Array<{ courseUnitId: string; courseOfferingId: string }>,
    forceRefresh = false
  ) {
    for (const r of reqs) {
      const k = keyOf(r.courseUnitId, r.courseOfferingId);
      const stale = isStaleKey(k);
      if (!forceRefresh && !stale && (hasFullKey(k) || isLoadingKey(k))) continue;
      hiQueue.set(k, r);
    }
    scheduleFlush();
  }

  function enqueueLow(courseUnitId: string, courseOfferingId: string) {
    const k = keyOf(courseUnitId, courseOfferingId);
    if (hasFullKey(k) || isLoadingKey(k)) return;
    if (!hiQueue.has(k)) loQueue.set(k, { courseUnitId, courseOfferingId });
    scheduleFlush();
  }

  // -------------------------
  // Public API
  // -------------------------

  const read = {
    keyOf(courseUnitId: string, courseOfferingId: string): string {
      return keyOf(courseUnitId, courseOfferingId);
    },

    isLoading(courseUnitId: string, courseOfferingId: string): boolean {
      return isLoadingKey(keyOf(courseUnitId, courseOfferingId));
    },

    isStale(courseUnitId: string, courseOfferingId: string): boolean {
      return isStaleKey(keyOf(courseUnitId, courseOfferingId));
    },

    hasFull(courseUnitId: string, courseOfferingId: string): boolean {
      return hasFullKey(keyOf(courseUnitId, courseOfferingId));
    },

    getGroups(courseUnitId: string, courseOfferingId: string): StudyGroup[] {
      return state.cache[keyOf(courseUnitId, courseOfferingId)] ?? [];
    },

    getCached(courseUnitId: string, courseOfferingId: string): StudyGroup[] | null {
      return state.cache[keyOf(courseUnitId, courseOfferingId)] ?? null;
    },

    getSummaries(courseUnitId: string, courseOfferingId: string): StudyGroupSummary[] {
      const k = keyOf(courseUnitId, courseOfferingId);
      return deriveSummaries(k, state);
    },

    /**
     * Centralized UI status so components never read store.state directly.
     */
    getStatus(courseUnitId: string, courseOfferingId: string) {
      const k = keyOf(courseUnitId, courseOfferingId);

      const hasFull = state.cache[k] !== undefined;
      const summaries = deriveSummaries(k, state);
      const hasSummaries = summaries.length > 0;
      const hasAny = hasFull || hasSummaries;

      const isLoading = !hasAny && state.loadingKeys.includes(k);
      const isStale = hasAny && state.staleKeys.has(k);

      return {
        key: k,
        hasFull,
        hasAny,
        isLoading,
        isStale,
      };
    },
  };

  const actions = {
    /**
     * Fetch with cached fallback. Returns cached full data immediately if present.
     * Otherwise enqueues low-priority fetch and returns [].
     */
    async fetch(courseUnitId: string, courseOfferingId: string): Promise<StudyGroup[]> {
      const key = keyOf(courseUnitId, courseOfferingId);
      const cached = state.cache[key];
      if (cached !== undefined) return cached;

      enqueueLow(courseUnitId, courseOfferingId);
      return state.cache[key] ?? [];
    },

    /**
     * Fetch and wait for fresh data.
     * Returns cached full data immediately, and triggers SWR refresh in background.
     * If no cache exists, enqueues high-priority fetch and waits until it resolves (or fails).
     */
    async fetchAndWait(courseUnitId: string, courseOfferingId: string): Promise<StudyGroup[]> {
      const key = keyOf(courseUnitId, courseOfferingId);
      const cached = state.cache[key];

      if (cached !== undefined) {
        if (!isLoadingKey(key) && !isStaleKey(key)) {
          markStale([key]);
          enqueueHigh([{ courseUnitId, courseOfferingId }]);
        }
        return cached;
      }

      enqueueHigh([{ courseUnitId, courseOfferingId }]);

      // Wait until either data appears OR loading stops (error)
      return new Promise((resolve) => {
        const stop = $effect.root(() => {
          $effect(() => {
            const data = state.cache[key];
            const done = data !== undefined || !state.loadingKeys.includes(key);
            if (done) {
              stop();
              resolve(data ?? []);
            }
          });
        });
      });
    },

    /**
     * High-priority batch enqueue (for multiple courses at once).
     * Does not wait; returns immediately.
     */
    async fetchBatch(
      requests: Array<{ courseUnitId: string; courseOfferingId: string }>
    ): Promise<void> {
      enqueueHigh(requests);
    },

    /**
     * Force refresh batch (ignores in-memory cache, always fetches).
     * Use when plan switches or user explicitly refreshes.
     */
    async forceRefreshBatch(
      requests: Array<{ courseUnitId: string; courseOfferingId: string }>
    ): Promise<void> {
      const staleKeys: string[] = [];

      for (const req of requests) {
        const k = keyOf(req.courseUnitId, req.courseOfferingId);
        const hasAny =
          state.cache[k] !== undefined ||
          state.summaryCache[k] !== undefined ||
          state.fallbackSummaries[k] !== undefined;

        if (hasAny) staleKeys.push(k);
      }

      if (staleKeys.length > 0) markStale(staleKeys);
      enqueueHigh(requests, true);
    },

    /**
     * Stale-while-revalidate: show cached data, refresh in background.
     */
    async fetchWithStaleWhileRevalidate(
      requests: Array<{ courseUnitId: string; courseOfferingId: string }>
    ): Promise<void> {
      actions.preloadFromCache(requests);

      const toEnqueue: Array<{ courseUnitId: string; courseOfferingId: string }> = [];
      const staleKeys: string[] = [];

      for (const req of requests) {
        const k = keyOf(req.courseUnitId, req.courseOfferingId);
        const hasFull = state.cache[k] !== undefined;
        const hasFallback = state.fallbackSummaries[k] !== undefined;
        const hasSummaryCache = state.summaryCache[k] !== undefined;

        const last = lastRefreshAt.get(k) ?? 0;
        const canRefresh = Date.now() - last > REFRESH_COOLDOWN_MS;

        if ((hasFull || hasSummaryCache || hasFallback) && canRefresh) {
          staleKeys.push(k);
          toEnqueue.push(req);
          lastRefreshAt.set(k, Date.now());
          continue;
        }

        if (!hasFull && !hasSummaryCache && !hasFallback) {
          toEnqueue.push(req);
        }
      }

      if (staleKeys.length > 0) markStale(staleKeys);
      if (toEnqueue.length > 0) enqueueHigh(toEnqueue);
    },

    /**
     * Preload fallback summaries from localStorage without touching full cache.
     * Used by stale-while-revalidate to enable instant display on page load.
     */
    preloadFromCache(
      requests: Array<{ courseUnitId: string; courseOfferingId: string }>
    ): void {
      const keys = requests.map((r) => keyOf(r.courseUnitId, r.courseOfferingId));

      const newFallback = { ...state.fallbackSummaries };
      const newSummary = { ...state.summaryCache };

      let changed = false;

      for (const k of keys) {
        if (newFallback[k]) continue;

        const hit = loadFromLocalStorage(k);
        if (hit) {
          newFallback[k] = hit;
          newSummary[k] = hit; // also populate summaryCache immediately
          changed = true;
        }
      }

      if (changed) {
        state.fallbackSummaries = newFallback;
        state.summaryCache = newSummary;
      }
    },

    /**
     * "Do the right thing" helper for components:
     * if there is no full data and we aren't already loading, enqueue a low-priority fetch.
     */
    ensureFetched(courseUnitId: string, courseOfferingId: string): void {
      const k = keyOf(courseUnitId, courseOfferingId);
      if (state.cache[k] !== undefined) return;
      if (state.loadingKeys.includes(k)) return;

      enqueueLow(courseUnitId, courseOfferingId);
    },

    clear(): void {
      hiQueue.clear();
      loQueue.clear();

      state.cache = {};
      state.summaryCache = {};
      state.fallbackSummaries = {};
      state.loadingKeys = [];
      state.error = null;
      state.staleKeys = new Set();
    },
  };

  return {
    state,
    read,
    actions,
  };
})();
