import { readable, type Readable } from "svelte/store";

import { StudyGroupCache } from "../cache/StudyGroupCache";
import type { StudyGroupEntry } from "../cache/StudyGroupEntry";
import {
  studyGroupKey,
  type StudyGroupRequest,
} from "../retrieval/StudyGroupRequest";

/**
 * Expose one offering's authoritative full-data cache entry
 * through Svelte's readable-store contract.
 *
 * This adapter does not own data, start retrievals, or apply
 * loading policy. StudyGroupCache remains authoritative.
 */
export function createStudyGroupEntryStore(
  cache: StudyGroupCache,
  request: StudyGroupRequest,
): Readable<StudyGroupEntry> {
  const key = studyGroupKey(request);

  return readable<StudyGroupEntry>(
    cache.get(key),
    (set) => {
      const unsubscribe = cache.subscribe((change) => {
        if (
          change.type === "clear" ||
          (change.type === "entry" && change.key === key)
        ) {
          set(cache.get(key));
        }
      });

      // Refresh the snapshot when the store becomes active.
      // The cache may have changed since the previous subscription.
      set(cache.get(key));

      return unsubscribe;
    },
  );
}
