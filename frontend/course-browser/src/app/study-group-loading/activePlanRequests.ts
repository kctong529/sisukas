import type { Course } from "@domain/models/Course";
import type { Plan } from "@domain/models/Plan";
import type { StudyGroupRequest } from "@modules/study-groups";

/**
 * Resolve the offerings in a plan into study-group retrieval requests.
 *
 * This function only maps plan membership to request identities.
 * It does not select a plan, initiate retrieval, or inspect cache state.
 *
 * Unresolved offerings are omitted. The caller is responsible for
 * invoking this again when additional course data becomes available.
 */
export function activePlanStudyGroupRequests(
  plan: Pick<Plan, "instanceIds">,
  resolveCourse: (
    offeringId: string,
  ) => Pick<Course, "unitId"> | undefined,
): StudyGroupRequest[] {
  const requests: StudyGroupRequest[] = [];
  const seen = new Set<string>();

  for (const offeringId of plan.instanceIds) {
    if (seen.has(offeringId)) continue;
    seen.add(offeringId);

    const course = resolveCourse(offeringId);
    if (!course) continue;

    requests.push({
      courseUnitId: course.unitId,
      courseOfferingId: offeringId,
    });
  }

  return requests;
}
