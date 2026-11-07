import type { StudyGroup } from "../../domain/models/StudyGroup";
import type { StudyGroupRequest } from "../../infrastructure/services/StudyGroupService";

export type { StudyGroupRequest };

export type StudyGroupKey = string;

export type StudyGroupLoadStatus =
  | "missing"
  | "queued"
  | "loading"
  | "ready"
  | "failed";

/** Null means no successful full response; [] means successfully empty. */
export interface StudyGroupEntry {
  groups: StudyGroup[] | null;
  status: StudyGroupLoadStatus;
  fetchedAt: number | null;
  error: string | null;
  refreshing: boolean;
}

/** Matches the current wrapper's result-key convention. */
export function studyGroupKey(request: StudyGroupRequest): StudyGroupKey {
  return `${request.courseUnitId}:${request.courseOfferingId}`;
}
