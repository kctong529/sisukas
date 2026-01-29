// src/domain/models/CourseSnapshot.ts
export interface CourseSnapshot {
  id: string;
  courseCode: string;
  courseId: string;
  courseUnitId: string | null;

  startDate: string | null;
  endDate: string | null;

  payload: Record<string, unknown>;
  snapshotHash: string;
  resolverStatus: string;
  source: string;

  requestedCount: number;
  firstRequestedAt: string;
  lastRequestedAt: string;

  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotStatus {
  courseCode: string;
  hasAny: boolean;
  hasLive: boolean;
  totalCount: number;
  liveCount: number;
  oldestCreatedAt: string | null;
  newestCreatedAt: string | null;
}

export interface ResolveAndStoreResponse {
  courseCode: string;
  snapshots: CourseSnapshot[];
}
