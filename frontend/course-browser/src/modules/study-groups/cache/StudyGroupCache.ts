import type { StudyGroup } from "../models/StudyGroup";
import type { StudyGroupEntry } from "./StudyGroupEntry";

export type StudyGroupCacheChange =
  | { type: "entry"; key: string }
  | { type: "clear" };

export type StudyGroupCacheListener = (
  change: StudyGroupCacheChange,
) => void;

const MISSING_ENTRY: Readonly<StudyGroupEntry> = {
  groups: null,
  status: "missing",
  fetchedAt: null,
  error: null,
  refreshing: false,
};

/**
 * Stores the latest full study-group data for each offering.
 *
 * The cache owns its data and returns independent copies to callers.
 * Subscribers receive change notifications, not mutable cache entries.
 *
 * It does not fetch, schedule, persist, or apply freshness policies.
 */
export class StudyGroupCache {
  private readonly entries = new Map<string, StudyGroupEntry>();

  private readonly listeners = new Set<StudyGroupCacheListener>();

  /**
   * Subscribe to successful cache state changes.
   *
   * Notifications are synchronous and occur after mutation.
   * Registration does not replay the current state.
   */
  subscribe(listener: StudyGroupCacheListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  get(key: string): StudyGroupEntry {
    const entry = this.entries.get(key) ?? MISSING_ENTRY;

    return {
      ...entry,
      groups:
        entry.groups === null
          ? null
          : structuredClone(entry.groups),
    };
  }

  /**
   * Begin an initial retrieval or retry without cached full data.
   */
  markLoading(key: string): void {
    const previous = this.entries.get(key) ?? MISSING_ENTRY;

    if (previous.groups !== null) {
      throw new Error(
        "Cannot start initial loading with cached full data",
      );
    }

    this.entries.set(key, {
      groups: null,
      status: "loading",
      fetchedAt: null,
      error: null,
      refreshing: false,
    });

    this.notify({ type: "entry", key });
  }

  /**
   * Store a successful full-data result, including an empty array.
   */
  markReady(
    key: string,
    groups: StudyGroup[],
    fetchedAt: number,
  ): void {
    this.entries.set(key, {
      groups: structuredClone(groups),
      status: "ready",
      fetchedAt,
      error: null,
      refreshing: false,
    });

    this.notify({ type: "entry", key });
  }

  /**
   * Record a failed retrieval without discarding previously loaded data.
   */
  markFailed(key: string, error: Error): void {
    const previous = this.entries.get(key) ?? MISSING_ENTRY;

    if (previous.groups !== null) {
      this.entries.set(key, {
        ...previous,
        status: "ready",
        error: error.message,
        refreshing: false,
      });
    } else {
      this.entries.set(key, {
        groups: null,
        status: "failed",
        fetchedAt: null,
        error: error.message,
        refreshing: false,
      });
    }

    this.notify({ type: "entry", key });
  }

  /**
   * Begin refreshing an already available full-data result.
   */
  markRefreshing(key: string): void {
    const previous = this.entries.get(key) ?? MISSING_ENTRY;

    if (previous.groups === null) {
      throw new Error(
        "Cannot refresh study groups without cached full data",
      );
    }

    this.entries.set(key, {
      ...previous,
      status: "ready",
      error: null,
      refreshing: true,
    });

    this.notify({ type: "entry", key });
  }

  /**
   * Forget every stored offering.
   *
   * The loader owns invalidation of outstanding asynchronous work.
   * Subscribers remain registered across clears.
   */
  clear(): void {
    this.entries.clear();
    this.notify({ type: "clear" });
  }

  /**
   * Publish a change without exposing internal cache references.
   *
   * A faulty listener must not interrupt cache mutations or prevent
   * other listeners from receiving the same notification.
   */
  private notify(change: StudyGroupCacheChange): void {
    for (const listener of this.listeners) {
      try {
        listener(change);
      } catch {
        // Subscribers are observers, not participants in cache
        // state transitions. Their errors cannot roll back
        // mutations or prevent other notifications.
      }
    }
  }
}
