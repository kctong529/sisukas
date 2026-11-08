import { StudyGroupCache } from "@modules/study-groups/cache/StudyGroupCache";
import {
  StudyGroupRequestCoordinator,
} from "./StudyGroupRequestCoordinator";
import {
  studyGroupKey,
  type StudyGroupRequest,
} from "./StudyGroupRequest";
import type { StudyGroupOutcome } from "./StudyGroupOutcome";

export interface StudyGroupCacheLoaderOptions {
  cache: StudyGroupCache;
  coordinator: StudyGroupRequestCoordinator;
  now?: () => number;
}

/**
 * Connects authoritative full-data caching to shared request execution.
 *
 * The loader owns cache-aware ensure/refresh behavior and protects
 * cache updates across resets.
 *
 * It does not implement batching, concurrency limits, HTTP transport,
 * TTL policies, persistence, or Svelte reactivity.
 */
export class StudyGroupCacheLoader {
  private readonly cache: StudyGroupCache;
  private readonly coordinator: StudyGroupRequestCoordinator;
  private readonly now: () => number;

  private readonly pending = new Map<string, Promise<void>>();
  private generation = 0;

  constructor(options: StudyGroupCacheLoaderOptions) {
    this.cache = options.cache;
    this.coordinator = options.coordinator;
    this.now = options.now ?? Date.now;
  }

  /**
   * Ensure that full data is available for each offering.
   *
   * Ready entries are reused. Missing and failed entries are loaded.
   * Callers join already pending work instead of starting duplicates.
   */
  async ensure(requests: StudyGroupRequest[]): Promise<void> {
    await this.load(requests, false);
  }

  /**
   * Explicitly retrieve the requested offerings again.
   *
   * Existing full data remains available while refreshing.
   * Concurrent calls for an already pending offering join that work.
   */
  async refresh(requests: StudyGroupRequest[]): Promise<void> {
    await this.load(requests, true);
  }

  /**
   * Invalidate cached data and outstanding coordinated work.
   *
   * Transport operations already dispatched may still complete, but
   * their outcomes must not restore cleared cache entries.
   */
  clear(): void {
    this.generation++;

    this.coordinator.clear();
    this.pending.clear();
    this.cache.clear();
  }

  private async load(
    requests: StudyGroupRequest[],
    force: boolean,
  ): Promise<void> {
    const tasks: Promise<void>[] = [];
    const seen = new Set<string>();

    for (const request of requests) {
      const key = studyGroupKey(request);

      // Avoid duplicate tasks within one invocation.
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);

      // A caller must be able to await work already in progress.
      const existing = this.pending.get(key);

      if (existing) {
        tasks.push(existing);
        continue;
      }

      const entry = this.cache.get(key);

      // Ensure reuses successfully loaded data, including [].
      if (!force && entry.groups !== null) {
        continue;
      }

      if (entry.groups !== null) {
        this.cache.markRefreshing(key);
      } else {
        this.cache.markLoading(key);
      }

      tasks.push(this.start(request, key));
    }

    await Promise.all(tasks);
  }

  private start(
    request: StudyGroupRequest,
    key: string,
  ): Promise<void> {
    const generation = this.generation;

    // The coordinator isolates observer exceptions, so an unrecoverable
    // cache-update error must be retained and surfaced after retrieval.
    let unrecoveredError: Error | null = null;

    const operation = this.coordinator.loadSettled(
      [request],
      {
        onOutcome: (outcomeKey, outcome) => {
          // Ignore notifications from an invalidated cache lifecycle.
          if (generation !== this.generation) {
            return;
          }

          try {
            this.applyOutcome(outcomeKey, outcome);
          } catch (error) {
            const applicationError =
              error instanceof Error
                ? error
                : new Error("Study-group cache update failed");

            try {
              // Preserve previously cached full data on refresh failure.
              this.cache.markFailed(outcomeKey, applicationError);
            } catch (recoveryError) {
              // The coordinator would swallow a thrown callback error.
              // Save it for the loader's own completion promise.
              unrecoveredError =
                recoveryError instanceof Error
                  ? recoveryError
                  : new Error(
                      "Study-group cache failure recovery failed",
                    );
            }
          }
        },
      },
    );

    const task: Promise<void> = operation
      .then(() => {
        if (unrecoveredError !== null) {
          throw unrecoveredError;
        }
      })
      .finally(() => {
        // An obsolete task must not remove a newer task for this key.
        if (this.pending.get(key) === task) {
          this.pending.delete(key);
        }
      });

    this.pending.set(key, task);

    return task;
  }


  private applyOutcome(
    key: string,
    outcome: StudyGroupOutcome,
  ): void {
    if (outcome.status === "success") {
      this.cache.markReady(
        key,
        outcome.groups,
        this.now(),
      );
      return;
    }

    this.cache.markFailed(key, outcome.error);
  }
}
