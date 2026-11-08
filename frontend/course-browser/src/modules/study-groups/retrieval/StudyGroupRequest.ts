export interface StudyGroupRequest {
  courseUnitId: string;
  courseOfferingId: string;
}

export type StudyGroupKey = string;

export function studyGroupKey(
  request: StudyGroupRequest,
): StudyGroupKey {
  return `${request.courseUnitId}:${request.courseOfferingId}`;
}
