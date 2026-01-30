// src/lib/stores/courseIndexStore.svelte.ts
import type { Course } from "../../domain/models/Course";
import { loadCoursesWithCache, loadHistoricalCoursesWithCache } from "../../infrastructure/loaders/RemoteCourseLoader";
import { SnapshotHistoricalMerge } from "../../infrastructure/loaders/SnapshotHistoricalMerge";

type SnapshotMergeStats = { fetched: number; merged: number; skipped: number };
const ZERO_SNAPSHOTS: SnapshotMergeStats = { fetched: 0, merged: 0, skipped: 0 };

type BootstrapActiveResult = { activeCount: number };
type BootstrapHistoricalResult = { historicalCount: number; mergedSnapshots: SnapshotMergeStats };

export type CourseIndexMode = "active" | "all";

// Dedup concurrent historical loads
let historicalPromise: Promise<BootstrapHistoricalResult> | null = null;

function buildIndexes(courses: Course[]) {
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

function mergePreferActive(active: Map<string, Course>, hist: Map<string, Course>) {
  const merged = new Map(hist);
  for (const [k, v] of active) merged.set(k, v);
  return merged;
}

function mergeIdsByCodePreferActive(
  active: Map<string, string[]>,
  hist: Map<string, string[]>
) {
  const merged = new Map<string, string[]>();
  for (const [code, ids] of hist) merged.set(code, [...ids]);
  for (const [code, ids] of active) {
    const prev = merged.get(code);
    merged.set(code, prev ? [...prev, ...ids] : [...ids]);
  }
  return merged;
}

export const courseIndexStore = (() => {
  // ----------------------------
  // state
  // ----------------------------
  const state = $state({
    // Active
    byInstanceId: new Map<string, Course>(),
    instanceIdsByCode: new Map<string, string[]>(),

    // Historical
    historicalByInstanceId: new Map<string, Course>(),
    historicalInstanceIdsByCode: new Map<string, string[]>(),

    // Status
    loading: false,
    error: null as string | null,
    historicalReady: false,
    historicalLoading: false,

    // View mode
    mode: "active" as CourseIndexMode,
  });

  // ----------------------------
  // derived: “current view”
  // ----------------------------
  const currentByInstanceId = $derived(
    state.mode === "active"
      ? state.byInstanceId
      : mergePreferActive(state.byInstanceId, state.historicalByInstanceId)
  );

  const currentInstanceIdsByCode = $derived(
    state.mode === "active"
      ? state.instanceIdsByCode
      : mergeIdsByCodePreferActive(state.instanceIdsByCode, state.historicalInstanceIdsByCode)
  );

  // ----------------------------
  // actions: bootstrapping
  // ----------------------------
  async function bootstrapActive(): Promise<BootstrapActiveResult> {
    state.loading = true;
    state.error = null;

    try {
      const activeCourses = await loadCoursesWithCache();
      const active = buildIndexes(activeCourses);

      state.byInstanceId = active.byInstanceId;
      state.instanceIdsByCode = active.instanceIdsByCode;

      return { activeCount: activeCourses.length };
    } catch (err) {
      state.byInstanceId = new Map();
      state.instanceIdsByCode = new Map();
      state.error = err instanceof Error ? err.message : "Failed to load active courses";
      throw err;
    } finally {
      state.loading = false;
    }
  }

  /**
   * Loads historical.json and then appends live snapshots into the historical index.
   * IMPORTANT: snapshots must be appended after base historical is loaded.
   */
  async function bootstrapHistorical(): Promise<BootstrapHistoricalResult> {
    state.historicalLoading = true;
    state.error = null;

    try {
      const historicalCourses = await loadHistoricalCoursesWithCache();
      const historical = buildIndexes(historicalCourses);

      // base historical first
      state.historicalByInstanceId = historical.byInstanceId;
      state.historicalInstanceIdsByCode = historical.instanceIdsByCode;
      state.historicalReady = true;

      // then append snapshots (into historical)
      const mergedSnapshots = await SnapshotHistoricalMerge.mergeAllLiveSnapshots();

      // one-time: remove overlaps + dedupe
      const pruned = pruneHistoricalAgainstActive(
        state.historicalByInstanceId,
        state.historicalInstanceIdsByCode,
        state.byInstanceId
      );

      state.historicalByInstanceId = pruned.byId;
      state.historicalInstanceIdsByCode = pruned.idsByCode;
      // optional debug:
      console.log("Pruned historical overlaps:", pruned.pruned);

      return { historicalCount: historicalCourses.length, mergedSnapshots };
    } catch (err) {
      state.historicalByInstanceId = new Map();
      state.historicalInstanceIdsByCode = new Map();
      state.historicalReady = false;
      state.error = err instanceof Error ? err.message : "Failed to load historical courses";
      throw err;
    } finally {
      state.historicalLoading = false;
    }
  }

  /**
   * Idempotent helper; safe to call multiple times.
   * (Closure-based: safe to destructure.)
   */
  function ensureHistoricalLoaded(): Promise<BootstrapHistoricalResult> {
    if (state.historicalReady) {
      return Promise.resolve({
        historicalCount: state.historicalByInstanceId.size,
        mergedSnapshots: ZERO_SNAPSHOTS,
      });
    }

    if (historicalPromise) return historicalPromise;

    historicalPromise = (async () => {
      try {
        return await bootstrapHistorical();
      } finally {
        historicalPromise = null;
      }
    })();

    return historicalPromise;
  }

  async function bootstrap(): Promise<{
    activeCount: number;
    historicalCount: number;
    mergedSnapshots: SnapshotMergeStats;
  }> {
    const { activeCount } = await bootstrapActive();
    const { historicalCount, mergedSnapshots } = await ensureHistoricalLoaded();
    return { activeCount, historicalCount, mergedSnapshots };
  }

  function pruneHistoricalAgainstActive(
    historicalById: Map<string, Course>,
    historicalIdsByCode: Map<string, string[]>,
    activeById: Map<string, Course>
  ) {
    if (activeById.size === 0 || historicalById.size === 0) {
      return { byId: historicalById, idsByCode: historicalIdsByCode, pruned: 0 };
    }

    const activeIds = new Set(activeById.keys());

    // 1) prune byId
    let pruned = 0;
    const nextById = new Map(historicalById);
    for (const id of activeIds) {
      if (nextById.delete(id)) pruned++;
    }

    // 2) prune idsByCode arrays (and also dedupe within historical while we're here)
    const nextIdsByCode = new Map<string, string[]>();
    for (const [code, ids] of historicalIdsByCode) {
      const seen = new Set<string>();
      const out: string[] = [];

      for (const id of ids) {
        if (activeIds.has(id)) continue;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(id);
      }

      if (out.length > 0) nextIdsByCode.set(code, out);
    }

    return { byId: nextById, idsByCode: nextIdsByCode, pruned };
  }

  // ----------------------------
  // actions: setters
  // ----------------------------
  function setCourses(courses: Course[]) {
    const { byInstanceId, instanceIdsByCode } = buildIndexes(courses);
    state.byInstanceId = byInstanceId;
    state.instanceIdsByCode = instanceIdsByCode;
    state.loading = false;
    state.error = null;
    return { byInstanceId, instanceIdsByCode };
  }

  function setHistoricalCourses(courses: Course[]) {
    const { byInstanceId, instanceIdsByCode } = buildIndexes(courses);
    state.historicalByInstanceId = byInstanceId;
    state.historicalInstanceIdsByCode = instanceIdsByCode;
    state.historicalReady = true;
    state.historicalLoading = false;
    state.error = null;
    return { historicalByInstanceId: byInstanceId, historicalInstanceIdsByCode: instanceIdsByCode };
  }

  function appendHistoricalCourses(courses: Course[]): { merged: number; skipped: number } {
    const byId = new Map(state.historicalByInstanceId);
    const idsByCode = new Map(state.historicalInstanceIdsByCode);

    let merged = 0;
    let skipped = 0;

    for (const c of courses) {
      if (byId.has(c.id)) {
        skipped++;
        continue;
      }
      byId.set(c.id, c);

      const code = c.code.value;
      const arr = idsByCode.get(code);
      if (arr) arr.push(c.id);
      else idsByCode.set(code, [c.id]);

      merged++;
    }

    state.historicalByInstanceId = byId;
    state.historicalInstanceIdsByCode = idsByCode;

    return { merged, skipped };
  }

  // ----------------------------
  // actions: mode
  // ----------------------------
  async function setMode(mode: CourseIndexMode) {
    state.mode = mode;
    if (mode === "all") await ensureHistoricalLoaded();
  }

  function toggleMode() {
    void setMode(state.mode === "active" ? "all" : "active");
  }

  // ----------------------------
  // read APIs
  // ----------------------------

  // Active only
  function getByInstanceId(instanceId: string): Course | undefined {
    return state.byInstanceId.get(instanceId) ?? undefined;
  }

  // Historical only
  function getHistoricalByInstanceId(instanceId: string): Course | undefined {
    return state.historicalByInstanceId.get(instanceId) ?? undefined;
  }

  // Old behavior: active first then historical (kept for compatibility)
  function resolveByInstanceId(instanceId: string): Course | undefined {
    return state.byInstanceId.get(instanceId) ?? state.historicalByInstanceId.get(instanceId) ?? undefined;
  }

  function resolveByInstanceIdWithSource(
    instanceId: string
  ): { course: Course; source: "active" | "historical" } | undefined {
    const active = state.byInstanceId.get(instanceId);
    if (active) return { course: active, source: "active" };
    const hist = state.historicalByInstanceId.get(instanceId);
    if (hist) return { course: hist, source: "historical" };
    return undefined;
  }

  function getInstanceIdsByCode(code: string): string[] {
    return state.instanceIdsByCode.get(code) ?? [];
  }

  function getHistoricalInstanceIdsByCode(code: string): string[] {
    return state.historicalInstanceIdsByCode.get(code) ?? [];
  }

  function getInstancesByCode(code: string): Course[] {
    const ids = getInstanceIdsByCode(code);
    return ids.map((id) => state.byInstanceId.get(id)).filter(Boolean) as Course[];
  }

  function getHistoricalInstancesByCode(code: string): Course[] {
    const ids = getHistoricalInstanceIdsByCode(code);
    return ids.map((id) => state.historicalByInstanceId.get(id)).filter(Boolean) as Course[];
  }

  function getAllActiveCourses(): Course[] {
    return Array.from(state.byInstanceId.values());
  }

  function getAllHistoricalCourses(): Course[] {
    return Array.from(state.historicalByInstanceId.values());
  }

  function getAllCourses(source: "active" | "historical"): Course[] {
    return source === "active" ? getAllActiveCourses() : getAllHistoricalCourses();
  }

  function resolveCurrentByInstanceId(instanceId: string): Course | undefined {
    return currentByInstanceId.get(instanceId) ?? undefined;
  }

  function getCurrentInstanceIdsByCode(code: string): string[] {
    return currentInstanceIdsByCode.get(code) ?? [];
  }

  function getCurrentInstancesByCode(code: string): Course[] {
    const ids = getCurrentInstanceIdsByCode(code);
    return ids.map((id) => currentByInstanceId.get(id)).filter(Boolean) as Course[];
  }

  function getAllCurrentCourses(): Course[] {
    return Array.from(currentByInstanceId.values());
  }

  function resolveLatestInstanceByCodeBeforeDate(code: string, beforeOrOn: Date): Course | undefined {
    const cutoffMs = beforeOrOn.getTime();

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

    let bestPreferred: Course | undefined = undefined;
    let bestFallback: Course | undefined = undefined;

    for (const id of ids) {
      const c = state.byInstanceId.get(id) ?? state.historicalByInstanceId.get(id);
      if (!c) continue;

      const startMs = c.courseDate.start.getTime();
      if (startMs > cutoffMs) continue;

      if (!bestFallback || startMs > bestFallback.courseDate.start.getTime()) {
        bestFallback = c;
      }

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
  }

  function isEmpty(): boolean {
    return state.byInstanceId.size === 0 && state.historicalByInstanceId.size === 0;
  }

  return {
    state,

    // actions
    actions: {
      bootstrapActive,
      bootstrapHistorical,
      ensureHistoricalLoaded,
      bootstrap,
      setCourses,
      setHistoricalCourses,
      appendHistoricalCourses,
      setMode,
      toggleMode,
    },

    // reads
    read: {
      getByInstanceId,
      getHistoricalByInstanceId,
      resolveByInstanceId,
      resolveByInstanceIdWithSource,
      getInstanceIdsByCode,
      getHistoricalInstanceIdsByCode,
      getInstancesByCode,
      getHistoricalInstancesByCode,
      getAllActiveCourses,
      getAllHistoricalCourses,
      getAllCourses,
      resolveLatestInstanceByCodeBeforeDate,
      isEmpty,

      // mode-aware
      resolveCurrentByInstanceId,
      getCurrentInstanceIdsByCode,
      getCurrentInstancesByCode,
      getAllCurrentCourses,
    },
  };
})();
