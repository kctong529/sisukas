// src/lib/stores/studyGroupStore.ts

import { writable } from 'svelte/store';
import { StudyGroupService } from '../../infrastructure/services/StudyGroupService';
import type { StudyGroup } from '../../domain/models/StudyGroup';

interface StudyGroupStoreState {
  cache: { [key: string]: StudyGroup[] };
  loadingKeys: string[];
  error: string | null;
}

/**
 * Reactive store for managing study group data fetching and caching.
 * 
 * - Fetches study groups on-demand and caches them
 * - Tracks loading state per course instance
 * - Prevents duplicate requests
 * - Used by StudyGroupsSection and future Plan components
 */
function createStudyGroupStore() {
  const initialState: StudyGroupStoreState = {
    cache: {},
    loadingKeys: [],
    error: null,
  };

  const { subscribe, update } = writable(initialState);
  const service = new StudyGroupService(import.meta.env.VITE_WRAPPER_API);

  return {
    subscribe,

    /**
     * Fetch and cache study groups for a course instance.
     * Returns cached data if available, otherwise fetches from API.
     * 
     * @param courseUnitId - The unit ID of the course
     * @param courseOfferingId - The offering ID of the course instance
     * @returns Promise resolving to array of StudyGroup models
     */
    async fetch(courseUnitId: string, courseOfferingId: string): Promise<StudyGroup[]> {
      const key = `${courseUnitId}:${courseOfferingId}`;

      // Check cache first
      let cached: StudyGroup[] | undefined;
      const unsubscribe = subscribe(state => {
        cached = state.cache[key];
      });
      unsubscribe();

      if (cached) {
        return cached;
      }

      // Mark as loading
      update(state => ({
        ...state,
        loadingKeys: [...state.loadingKeys, key],
      }));

      try {
        const studyGroups = await service.fetchStudyGroups(courseUnitId, courseOfferingId);

        update(state => ({
          ...state,
          cache: { ...state.cache, [key]: studyGroups },
          loadingKeys: state.loadingKeys.filter(k => k !== key),
          error: null,
        }));

        return studyGroups;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch study groups';

        update(state => ({
          ...state,
          loadingKeys: state.loadingKeys.filter(k => k !== key),
          error: errorMessage,
        }));

        return [];
      }
    },

    /**
     * Batch fetch study groups for multiple course instances.
     * More efficient than individual fetches.
     * 
     * @param requests Array of course references (max 100)
     */
    async fetchBatch(
      requests: Array<{ courseUnitId: string; courseOfferingId: string }>
    ): Promise<void> {
      if (requests.length === 0) return;

      // Mark all as loading
      const loadingKeys = requests.map(r => `${r.courseUnitId}:${r.courseOfferingId}`);
      update(state => ({
        ...state,
        loadingKeys: [...state.loadingKeys, ...loadingKeys],
      }));

      try {
        const results = await service.fetchStudyGroupsBatch(requests);

        update(state => {
          const newCache = { ...state.cache };
          const newLoadingKeys = state.loadingKeys.filter(k => !loadingKeys.includes(k));

          for (const [key, groups] of results) {
            newCache[key] = groups;
          }

          return {
            ...state,
            cache: newCache,
            loadingKeys: newLoadingKeys,
            error: null,
          };
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Batch fetch failed';

        update(state => ({
          ...state,
          loadingKeys: state.loadingKeys.filter(k => !loadingKeys.includes(k)),
          error: errorMessage,
        }));
      }
    },

    /**
     * Check if study groups are currently loading for a course instance.
     */
    isLoading(courseUnitId: string, courseOfferingId: string): boolean {
      let isLoading = false;
      const unsubscribe = subscribe(state => {
        const key = `${courseUnitId}:${courseOfferingId}`;
        isLoading = state.loadingKeys.includes(key);
      });
      unsubscribe();
      return isLoading;
    },

    /**
     * Get cached study groups for a course instance without fetching.
     */
    getCached(courseUnitId: string, courseOfferingId: string): StudyGroup[] | null {
      let groups: StudyGroup[] | null = null;
      const unsubscribe = subscribe(state => {
        const key = `${courseUnitId}:${courseOfferingId}`;
        groups = state.cache[key] || null;
      });
      unsubscribe();
      return groups;
    },

    /**
     * Clear all cached study groups and error state.
     */
    clear() {
      update(() => ({
        cache: {},
        loadingKeys: [],
        error: null,
      }));
    },
  };
}

export const studyGroupStore = createStudyGroupStore();