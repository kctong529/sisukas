// src/domain/models/CourseSnapshot.ts
export type ResolveResponse = {
  courseCode: string;
  status: "ok" | "not_found";
  courseUnitIds: string[];
  assessmentItemIds: string[];
  matches: Array<Record<string, unknown>>;
};

export type CourseSnapshot = {
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
  firstRequestedAt: Date;
  lastRequestedAt: Date;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
