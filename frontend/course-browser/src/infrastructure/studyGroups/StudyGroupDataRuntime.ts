import type { Readable } from "svelte/store";

import { StudyGroupCache } from
  "@application/studyGroups/StudyGroupCache";
import { StudyGroupCacheLoader } from
  "@application/studyGroups/StudyGroupCacheLoader";
import type { StudyGroupEntry } from
  "@application/studyGroups/StudyGroupEntry";
import type { StudyGroupRequest } from
  "@application/studyGroups/StudyGroupRequest";
import { StudyGroupRequestCoordinator } from
  "@application/studyGroups/StudyGroupRequestCoordinator";

import { StudyGroupService } from
  "@infrastructure/services/StudyGroupService";
import { createStudyGroupTransport } from
  "@infrastructure/studyGroups/StudyGroupTransport";

import { createStudyGroupEntryStore } from
  "@lib/stores/studyGroupEntryStore";

/**
 * Public access to the shared full-data retrieval pipeline.
 *
 * Consumers can observe entries and request retrieval, but cannot
 * directly mutate the authoritative cache or control scheduling.
 */
export interface StudyGroupDataRuntime {
  entry(
    request: StudyGroupRequest,
  ): Readable<StudyGroupEntry>;

  ensure(
    requests: StudyGroupRequest[],
  ): Promise<void>;

  refresh(
    requests: StudyGroupRequest[],
  ): Promise<void>;

  clear(): void;
}

/**
 * Construction dependencies and coordinator configuration.
 *
 * This interface intentionally excludes freshness policies and
 * automatic loading behavior.
 */
export interface StudyGroupDataRuntimeOptions {
  service: StudyGroupService;
  now?: () => number;
  chunkSize?: number;
  concurrency?: number;
}

/**
 * Construct an independent full-data runtime.
 *
 * Each invocation owns its own cache, coordinator, and loader.
 * No retrieval occurs until ensure() or refresh() is called.
 */
export function createStudyGroupDataRuntime(
  options: StudyGroupDataRuntimeOptions,
): StudyGroupDataRuntime {
  const cache = new StudyGroupCache();

  const coordinator = new StudyGroupRequestCoordinator({
    transport: createStudyGroupTransport(options.service),
    chunkSize: options.chunkSize,
    concurrency: options.concurrency,
  });

  const loader = new StudyGroupCacheLoader({
    cache,
    coordinator,
    now: options.now,
  });

  return {
    entry(request) {
      return createStudyGroupEntryStore(cache, request);
    },

    ensure(requests) {
      return loader.ensure(requests);
    },

    refresh(requests) {
      return loader.refresh(requests);
    },

    clear() {
      loader.clear();
    },
  };
}

/**
 * Shared production instance for browser-side consumers.
 *
 * Lazy construction ensures module imports do not eagerly create
 * services or initiate network requests.
 */
let productionRuntime: StudyGroupDataRuntime | undefined;

export function getStudyGroupDataRuntime():
  StudyGroupDataRuntime {
  if (!productionRuntime) {
    const service = new StudyGroupService(
      import.meta.env.VITE_WRAPPER_API,
    );

    productionRuntime = createStudyGroupDataRuntime({
      service,
    });
  }

  return productionRuntime;
}
