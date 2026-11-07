import type { StudyGroup } from "@domain/models/StudyGroup";
import type { StudyGroupEntry } from "./StudyGroupEntry";

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
 * This cache does not fetch data, schedule requests, apply TTL policies,
 * or manage Svelte reactivity.
 */
export class StudyGroupCache {
  private readonly entries = new Map<string, StudyGroupEntry>();

  get(key: string): StudyGroupEntry {
    const entry = this.entries.get(key) ?? MISSING_ENTRY;

    return {
      ...entry,
    };
  }

  /**
   * Begin an initial retrieval or retry when no full data is available.
   */
  markLoading(key: string): void {
    this.entries.set(key, {
      groups: null,
      status: "loading",
      fetchedAt: null,
      error: null,
      refreshing: false,
    });
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
      groups,
      status: "ready",
      fetchedAt,
      error: null,
      refreshing: false,
    });
  }

  /**
   * Record a failed retrieval without discarding previously loaded data.
   */
  markFailed(key: string, error: Error): void {
    const previous = this.get(key);

    if (previous.groups !== null) {
      this.entries.set(key, {
        ...previous,
        status: "ready",
        error: error.message,
        refreshing: false,
      });
      return;
    }

    this.entries.set(key, {
      groups: null,
      status: "failed",
      fetchedAt: null,
      error: error.message,
      refreshing: false,
    });
  }

  /**
   * Begin refreshing an already available full-data result.
   */
  markRefreshing(key: string): void {
    const previous = this.get(key);

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
  }

  /**
   * Forget every stored offering.
   *
   * The future coordinator adapter owns protection against late
   * asynchronous completions.
   */
  clear(): void {
    this.entries.clear();
  }
}
