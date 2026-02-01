// src/lib/stores/studyGroupStore.ts
import { writable, get } from "svelte/store";
import { StudyGroupService } from "../../infrastructure/services/StudyGroupService";
import type { StudyGroup } from "../../domain/models/StudyGroup";

const LS_PREFIX = "sisukas:studyGroups:v1";
// TTL: 1 day for localStorage cache
// Why 1 day? Upstream updates daily, but stale-while-revalidate keeps data fresh anyway
// Even if cache expires, user sees derived summary instantly and fetch updates it in background
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

interface StudyGroupStoreState {
  // Single source of truth for full study group data
  cache: { [key: string]: StudyGroup[] | undefined };
  // In-memory summary cache (derived from full data when it arrives)
  // Used for fast display while full data loads
  summaryCache: { [key: string]: StudyGroupSummary[] };
  // Fallback only: localStorage summaries for first-ever load
  fallbackSummaries: { [key: string]: StudyGroupSummary[] };
  loadingKeys: string[];
  error: string | null;
  staleKeys: Set<string>; // Keys with cached data but stale (background refresh active)
}

type CachedEntry = { fetchedAt: number; groups: StudyGroupSummary[] };

function lsKey(k: string) {
  return `${LS_PREFIX}:${k}`;
}

function saveToLocalStorage(k: string, groups: StudyGroupSummary[]) {
  try {
    const entry: CachedEntry = { fetchedAt: Date.now(), groups };
    localStorage.setItem(lsKey(k), JSON.stringify(entry));
  } catch (err) {
    console.warn("localStorage write failed:", err);
  }
}

function loadFromLocalStorage(k: string): StudyGroupSummary[] | null {
  try {
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

function aggregateSchedule(
  events: { startIso?: string; start: string; endIso?: string; end: string }[]
): string {
  if (!events?.length) return "No events";

  const timeSlotMap = new Map<string, Set<string>>();

  for (const e of events) {
    const start = new Date(e.startIso ?? e.start);
    const end = new Date(e.endIso ?? e.end);

    const day = start.toLocaleDateString("en-US", { weekday: "short" });
    const startTime = start.toLocaleTimeString("en-FI", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const endTime = end.toLocaleTimeString("en-FI", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const slot = `${startTime} - ${endTime}`;
    if (!timeSlotMap.has(slot)) timeSlotMap.set(slot, new Set());
    timeSlotMap.get(slot)!.add(day);
  }

  const patterns: string[] = [];
  for (const [slot, days] of timeSlotMap.entries()) {
    patterns.push(`${Array.from(days).join(", ")} ${slot}`);
  }

  return patterns.join(" | ");
}

/**
 * Convert full StudyGroup objects to summaries.
 * Centralized here to ensure consistency across the store.
 */
function toSummaries(groups: StudyGroup[]): StudyGroupSummary[] {
  return groups.map((g) => {
    try {
      const schedule = aggregateSchedule(g.studyEvents ?? []);
      return {
        groupId: g.groupId,
        name: g.name,
        type: g.type,
        schedule: schedule,
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

function createStudyGroupStore() {
  const { subscribe, update } = writable<StudyGroupStoreState>({
    cache: {},
    summaryCache: {},
    fallbackSummaries: {},
    loadingKeys: [],
    error: null,
    staleKeys: new Set(),
  });

  const service = new StudyGroupService(import.meta.env.VITE_WRAPPER_API);

  // Two queues: batch gets priority
  const hiQueue = new Map<string, { courseUnitId: string; courseOfferingId: string }>();
  const loQueue = new Map<string, { courseUnitId: string; courseOfferingId: string }>();

  let flushScheduled = false;

  const keyOf = (u: string, o: string) => `${u}:${o}`;
  const hasFull = (key: string) => get({ subscribe }).cache[key] !== undefined;
  const isLoading = (key: string) => get({ subscribe }).loadingKeys.includes(key);
  const isStale = (key: string) => get({ subscribe }).staleKeys.has(key);

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

  function markStale(keys: string[]) {
    if (keys.length === 0) return;
    update((s) => {
      const newStale = new Set(s.staleKeys);
      keys.forEach((k) => newStale.add(k));
      return { ...s, staleKeys: newStale };
    });
  }

  function clearStale(keys: string[]) {
    if (keys.length === 0) return;
    update((s) => {
      const newStale = new Set(s.staleKeys);
      keys.forEach((k) => newStale.delete(k));
      return { ...s, staleKeys: newStale };
    });
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
    const state = get({ subscribe });

    const isCachedNow = (k: string) => state.cache[k] !== undefined;
    const isLoadingNow = (k: string) => state.loadingKeys.includes(k);
    const isStaleNow = (k: string) => state.staleKeys.has(k);

    const drainFrom = (q: typeof hiQueue | typeof loQueue) => {
      for (const [k, v] of q.entries()) {
        // If it's stale, we always want to send it to get fresh data.
        if (!isStaleNow(k) && (isCachedNow(k) || isLoadingNow(k))) {
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
          update((s) => {
            const newCache = { ...s.cache };
            const newSummary = { ...s.summaryCache };
            const newFallback = { ...s.fallbackSummaries };

            for (const [k, groups] of partial.entries()) {
              // Update full cache (source of truth)
              newCache[k] = groups;
              
              // Derive and update summary cache (for fast display)
              const summaries = toSummaries(groups);
              newSummary[k] = summaries;
              
              // Also update fallback (for localStorage persistence)
              newFallback[k] = summaries;
              
              // Persist to localStorage for next session
              saveToLocalStorage(k, summaries);
            }

            return { ...s, cache: newCache, summaryCache: newSummary, fallbackSummaries: newFallback, error: null };
          });

          // Clear markers as chunks arrive
          clearLoading(keys);
          clearStale(keys);
        },
      });
    } catch (e) {
      update((s) => ({
        ...s,
        error: e instanceof Error ? e.message : "Batch fetch failed",
      }));
      
      // On error, clear loading/stale markers so UI isn't stuck
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
      const stale = isStale(k);
      if (!forceRefresh && !stale && (hasFull(k) || isLoading(k))) continue;
      hiQueue.set(k, r);
    }
    scheduleFlush();
  }

  function enqueueLow(courseUnitId: string, courseOfferingId: string) {
    const k = keyOf(courseUnitId, courseOfferingId);
    if (hasFull(k) || isLoading(k)) return;
    if (!hiQueue.has(k)) loQueue.set(k, { courseUnitId, courseOfferingId });
    scheduleFlush();
  }

  /**
   * Derive summaries from cache, falling back gracefully.
   * Priority: full data → summary cache → fallback summaries
   */
  function deriveSummaries(key: string, state: StudyGroupStoreState): StudyGroupSummary[] {
    // Prefer full data if we have it (always fresh)
    const fullData = state.cache[key];
    if (fullData !== undefined) return toSummaries(fullData);

    // Fall back to summary cache (fast in-memory display)
    if (state.summaryCache[key]) {
      return state.summaryCache[key];
    }

    // Final fallback: localStorage summaries
    return state.fallbackSummaries[key] ?? [];
  }

  return {
    subscribe,

    /**
     * Fetch with cached fallback, returns data immediately if cached.
     * Enqueues low-priority fetch if not cached.
     */
    async fetch(courseUnitId: string, courseOfferingId: string): Promise<StudyGroup[]> {
      const key = keyOf(courseUnitId, courseOfferingId);
      const cached = get({ subscribe }).cache[key];
      if (cached !== undefined) return cached;

      enqueueLow(courseUnitId, courseOfferingId);

      return get({ subscribe }).cache[key] ?? [];
    },

    /**
     * Fetch and wait for fresh data.
     * Returns cached data immediately, then waits for fresh data if not cached.
     * Useful when you need to be sure you have current data.
     */
    async fetchAndWait(
      courseUnitId: string,
      courseOfferingId: string
    ): Promise<StudyGroup[]> {
      const key = keyOf(courseUnitId, courseOfferingId);
      const state = get({ subscribe });
      const cached = state.cache[key];

      // If we have full cached data, return it but enqueue a stale-while-revalidate refresh
      if (cached !== undefined) {
        if (!isLoading(key) && !isStale(key)) {
          markStale([key]);
          enqueueHigh([{ courseUnitId, courseOfferingId }]);
        }
        return cached;
      }

      // No cache: enqueue high-priority fetch and wait for it
      enqueueHigh([{ courseUnitId, courseOfferingId }]);

      return new Promise((resolve) => {
        const unsubscribe = subscribe((s) => {
          const data = s.cache[key];
          const done = data !== undefined || !s.loadingKeys.includes(key);
          if (done) {
            unsubscribe();
            resolve(data ?? []);
          }
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
      const state = get({ subscribe });
      const staleKeys: string[] = [];

      for (const req of requests) {
        const k = keyOf(req.courseUnitId, req.courseOfferingId);

        // Mark as stale if we have any cached data
        const hasAny =
          state.cache[k] !== undefined ||
          state.summaryCache[k] !== undefined ||
          state.fallbackSummaries[k] !== undefined;

        if (hasAny) staleKeys.push(k);
      }

      // Mark as stale first
      if (staleKeys.length > 0) {
        markStale(staleKeys);
      }

      // Force enqueue
      enqueueHigh(requests, true);
    },

    /**
     * Stale-while-revalidate: show cached data, refresh in background.
     * Perfect for list views where you want instant rendering.
     *
     * Flow:
     * 1. Preload fallback summaries from localStorage into state
     * 2. Mark items with summaries as "stale" (shows "Refreshing..." badge)
     * 3. Enqueue high-priority fetch for items that are stale OR have no cache
     * 4. Component derives summaries from cache (or fallback), shows instantly
     * 5. Fresh full data arrives → summaries auto-derived from it, badge disappears
     */
    async fetchWithStaleWhileRevalidate(
      requests: Array<{ courseUnitId: string; courseOfferingId: string }>
    ): Promise<void> {
      // Preload fallback summaries from localStorage for instant display
      this.preloadFromCache(requests);

      const state = get({ subscribe });
      const toEnqueue: Array<{ courseUnitId: string; courseOfferingId: string }> = [];
      const staleKeys: string[] = [];

      for (const req of requests) {
        const k = keyOf(req.courseUnitId, req.courseOfferingId);
        const hasFull = state.cache[k] !== undefined;
        const hasFallback = state.fallbackSummaries[k] !== undefined;
        const hasSummaryCache = state.summaryCache[k] !== undefined;

        // Check if enough time has passed since last refresh
        const last = lastRefreshAt.get(k) ?? 0;
        const canRefresh = Date.now() - last > REFRESH_COOLDOWN_MS;

        // If we have cached data (full or summary) and cooldown passed:
        // Mark as stale and enqueue for refresh
        if ((hasFull || hasSummaryCache || hasFallback) && canRefresh) {
          staleKeys.push(k);
          toEnqueue.push(req);
          lastRefreshAt.set(k, Date.now());
          continue;
        }

        // If we have NO cached data at all, load it (regardless of cooldown)
        if (!hasFull && !hasSummaryCache && !hasFallback) {
          toEnqueue.push(req);
        }
      }

      // Mark as stale BEFORE enqueueing so component sees it immediately
      if (staleKeys.length > 0) {
        markStale(staleKeys);
      }

      // Only enqueue items that need refreshing or don't have data
      if (toEnqueue.length > 0) {
        enqueueHigh(toEnqueue);
      }
    },

    isLoading(courseUnitId: string, courseOfferingId: string): boolean {
      return isLoading(keyOf(courseUnitId, courseOfferingId));
    },

    isStale(courseUnitId: string, courseOfferingId: string): boolean {
      return isStale(keyOf(courseUnitId, courseOfferingId));
    },

    getCached(courseUnitId: string, courseOfferingId: string): StudyGroup[] | null {
      return get({ subscribe }).cache[keyOf(courseUnitId, courseOfferingId)] ?? null;
    },

    /**
     * Get summaries derived from full data if available, otherwise from fallback cache.
     * This is the main method for displaying summaries in components.
     * Always returns the most current data available.
     */
    getSummaries(courseUnitId: string, courseOfferingId: string): StudyGroupSummary[] {
      const key = keyOf(courseUnitId, courseOfferingId);
      const state = get({ subscribe });
      return deriveSummaries(key, state);
    },

    /**
     * Get summaries only from in-memory cache (not full data, not fallback).
     * Fast access to cached summaries for display.
     * Returns null if not cached.
     */
    getSummaryCached(courseUnitId: string, courseOfferingId: string): StudyGroupSummary[] | null {
      return get({ subscribe }).summaryCache[keyOf(courseUnitId, courseOfferingId)] ?? null;
    },

    /**
     * Subscribe to summaries that auto-update when full data arrives.
     * Perfect for reactive components that need to display schedules.
     */
    subscribeToSummaries(
      courseUnitId: string,
      courseOfferingId: string,
      callback: (summaries: StudyGroupSummary[]) => void
    ): () => void {
      const key = keyOf(courseUnitId, courseOfferingId);
      return subscribe((state) => {
        const summaries = deriveSummaries(key, state);
        callback(summaries);
      });
    },

    clear() {
      hiQueue.clear();
      loQueue.clear();
      update(() => ({
        cache: {},
        summaryCache: {},
        fallbackSummaries: {},
        loadingKeys: [],
        error: null,
        staleKeys: new Set(),
      }));
    },

    hasFull(courseUnitId: string, courseOfferingId: string): boolean {
      return get({ subscribe }).cache[keyOf(courseUnitId, courseOfferingId)] !== undefined;
    },

    /**
     * Preload fallback summaries from localStorage without touching full cache.
     * Used by stale-while-revalidate to enable instant display on page load.
     */
    preloadFromCache(
      requests: Array<{ courseUnitId: string; courseOfferingId: string }>
    ): void {
      const keys = requests.map((r) => keyOf(r.courseUnitId, r.courseOfferingId));

      update((s) => {
        const newFallback = { ...s.fallbackSummaries };
        const newSummary = { ...s.summaryCache };

        for (const k of keys) {
          if (newFallback[k]) {
            // Already loaded
            continue;
          }
          const hit = loadFromLocalStorage(k);
          if (hit) {
            newFallback[k] = hit;
            newSummary[k] = hit;  // Also populate summaryCache immediately!
          }
        }

        return { ...s, fallbackSummaries: newFallback, summaryCache: newSummary };
      });
    },
  };
}

export const studyGroupStore = createStudyGroupStore();
