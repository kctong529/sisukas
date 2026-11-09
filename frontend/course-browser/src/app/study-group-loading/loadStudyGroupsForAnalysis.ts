import { get } from "svelte/store";

import type { StudyGroup, StudyGroupDataRuntime, StudyGroupRequest } from "@modules/study-groups";

/** Ensure full source data is available before constructing an analytics payload.
 * Missing or failed data must not silently become an empty course offering.
 */
export async function loadStudyGroupsForAnalysis(
  requests: StudyGroupRequest[],
  runtime: StudyGroupDataRuntime,
): Promise<(unitId: string, offeringId: string) => StudyGroup[]> {
  const unique = new Map<string, StudyGroupRequest>();
  for (const request of requests) {
    unique.set(JSON.stringify([request.courseUnitId, request.courseOfferingId]), request);
  }

  await runtime.ensure([...unique.values()]);

  const groups = new Map<string, StudyGroup[]>();
  for (const [key, request] of unique) {
    const entry = get(runtime.entry(request));
    if (entry.groups === null) {
      throw new Error(`Study groups are unavailable for offering ${request.courseOfferingId}`);
    }
    groups.set(key, entry.groups);
  }

  return (unitId, offeringId) => {
    const key = JSON.stringify([unitId, offeringId]);
    const result = groups.get(key);
    if (!result) {
      throw new Error(`Study groups were not prepared for offering ${offeringId}`);
    }
    return result;
  };
}
