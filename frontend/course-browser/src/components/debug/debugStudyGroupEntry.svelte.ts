import { createSubscriber } from "svelte/reactivity";
/** Debug-only observable reads. No cache ownership or automatic retrieval. */
import { get } from "svelte/store";

import { getStudyGroupDataRuntime } from "@modules/study-groups";

import type { StudyGroupEntry } from "@modules/study-groups";

const readers = new Map<string, () => StudyGroupEntry>();

export function debugStudyGroupEntry(unitId: string, offeringId: string): StudyGroupEntry {
  const key = JSON.stringify([unitId, offeringId]);
  let read = readers.get(key);
  if (!read) {
    const entry = getStudyGroupDataRuntime().entry({
      courseUnitId: unitId,
      courseOfferingId: offeringId,
    });
    const track = createSubscriber(update => entry.subscribe(() => update()));
    read = () => {
      track();
      return get(entry);
    };
    readers.set(key, read);
  }
  return read();
}
