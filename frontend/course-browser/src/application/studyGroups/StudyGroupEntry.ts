import type { StudyGroup } from "../../domain/models/StudyGroup";

export type StudyGroupLoadStatus =
  | "missing"
  | "queued"
  | "loading"
  | "ready"
  | "failed";

export interface StudyGroupEntry {
  groups: StudyGroup[] | null;
  status: StudyGroupLoadStatus;
  fetchedAt: number | null;
  error: string | null;
  refreshing: boolean;
}
