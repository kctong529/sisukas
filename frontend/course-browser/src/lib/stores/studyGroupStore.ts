// src/lib/stores/studyGroupStore.ts
import { writable, get } from "svelte/store";
import { StudyGroupService } from "../../infrastructure/services/StudyGroupService";
import type { StudyGroup } from "../../domain/models/StudyGroup";

const LS_PREFIX = "sisukas:studyGroups:v1";
const TTL_MS = 1000 * 60 * 60 * 24 * 7;

export type StudyGroupSummary = {
  groupId: string;
  name: string;
  type: string;
  schedule: string;
  eventCount: number;
};

interface StudyGroupStoreState {
  cache: { [key: string]: StudyGroup[] };
  summaryCache: { [key: string]: StudyGroupSummary[] };
  loadingKeys: string[];
  error: string | null;
}

type CachedEntry = { fetchedAt: number; groups: StudyGroupSummary[] };

function lsKey(k: string) {
  return `${LS_PREFIX}:${k}`;
}

function saveToLocalStorage(k: string, groups: StudyGroupSummary[]) {
  try {
    const entry: CachedEntry = { fetchedAt: Date.now(), groups };
    localStorage.setItem(lsKey(k), JSON.stringify(entry));
  } catch {
    // ignore quota / private mode errors
  }
}

function loadFromLocalStorage(k: string): StudyGroupSummary[] | null {
  try {
    const raw = localStorage.getItem(lsKey(k));
    if (!raw) return null;

    const entry = JSON.parse(raw) as CachedEntry;
    if (!entry?.groups || typeof entry.fetchedAt !== "number") return null;

    if (Date.now() - entry.fetchedAt > TTL_MS) {
      localStorage.removeItem(lsKey(k));
      return null;
    }

    return entry.groups;
  } catch {
    return null;
  }
}

function aggregateSchedule(events: { startIso?: string; start: string; endIso?: string; end: string }[]): string {
  if (!events?.length) return "No events";

  const timeSlotMap = new Map<string, Set<string>>();

  for (const e of events) {
    const start = new Date(e.startIso ?? e.start);
    const end = new Date(e.endIso ?? e.end);

    const day = start.toLocaleDateString("en-US", { weekday: "short" });
    const startTime = start.toLocaleTimeString("en-FI", { hour: "2-digit", minute: "2-digit", hour12: false });
    const endTime = end.toLocaleTimeString("en-FI", { hour: "2-digit", minute: "2-digit", hour12: false });

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

function toSummaries(groups: StudyGroup[]): StudyGroupSummary[] {
  return groups.map((g) => ({
    groupId: g.groupId,
    name: g.name,
    type: g.type,
    schedule: aggregateSchedule(g.studyEvents ?? []),
    eventCount: g.studyEvents?.length ?? 0,
  }));
}

function createStudyGroupStore() {
  const { subscribe, update } = writable<StudyGroupStoreState>({
    cache: {},
    summaryCache: {},
    loadingKeys: [],
    error: null,
  });

  const service = new StudyGroupService(import.meta.env.VITE_WRAPPER_API);

  // Two queues: batch gets priority
  const hiQueue = new Map<string, { courseUnitId: string; courseOfferingId: string }>();
  const loQueue = new Map<string, { courseUnitId: string; courseOfferingId: string }>();

  let flushScheduled = false;

  const keyOf = (u: string, o: string) => `${u}:${o}`;

  const hasFull = (key: string) => {
    const s = get({ subscribe });
    return Boolean(s.cache[key]);
  };

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
    const isCachedNow = (k: string) => Boolean(state.cache[k]);
    const isLoadingNow = (k: string) => state.loadingKeys.includes(k);

    const drainFrom = (q: typeof hiQueue | typeof loQueue) => {
      for (const [k, v] of q.entries()) {
        if (isCachedNow(k) || isLoadingNow(k)) {
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
      await service.fetchStudyGroupsBatch(toSend, {
        chunkSize: 20,
        concurrency: 4,
        onChunk: (partial) => {
          update((s) => {
            const newCache = { ...s.cache };
            const newSummary = { ...s.summaryCache };

            for (const [k, groups] of partial.entries()) {
              newCache[k] = groups;

              const summaries = toSummaries(groups);
              newSummary[k] = summaries;

              saveToLocalStorage(k, summaries);
            }

            return { ...s, cache: newCache, summaryCache: newSummary, error: null };
          });

          clearLoading([...partial.keys()]);
        },
      });
    } catch (e) {
      update((s) => ({
        ...s,
        error: e instanceof Error ? e.message : "Batch fetch failed",
      }));
    } finally {
      // in case some keys never returned due to error handling, clear remaining:
      clearLoading(loadingKeys);
    }

    // If new items were queued during the fetch, flush again.
    if (hiQueue.size > 0 || loQueue.size > 0) scheduleFlush();
  }

  function enqueueHigh(reqs: Array<{ courseUnitId: string; courseOfferingId: string }>) {
    for (const r of reqs) {
      const k = keyOf(r.courseUnitId, r.courseOfferingId);
      if (hasFull(k) || isLoading(k)) continue;
      hiQueue.set(k, r);
    }
    scheduleFlush();
  }

  function enqueueLow(courseUnitId: string, courseOfferingId: string) {
    const k = keyOf(courseUnitId, courseOfferingId);
    if (hasFull(k) || isLoading(k)) return;
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
      update(() => ({ cache: {}, summaryCache: {}, loadingKeys: [], error: null }));
    },

    preloadFromCache(requests: Array<{ courseUnitId: string; courseOfferingId: string }>) {
      const keys = requests.map((r) => keyOf(r.courseUnitId, r.courseOfferingId));

      update((s) => {
        const newSummary = { ...s.summaryCache };

        for (const k of keys) {
          if (newSummary[k]) continue;
          const hit = loadFromLocalStorage(k);
          if (hit) newSummary[k] = hit;
        }

        return { ...s, summaryCache: newSummary };
      });
    },

    getSummaryCached(courseUnitId: string, courseOfferingId: string): StudyGroupSummary[] | null {
      return get({ subscribe }).summaryCache[keyOf(courseUnitId, courseOfferingId)] ?? null;
    },
  }
}

export const studyGroupStore = createStudyGroupStore();
