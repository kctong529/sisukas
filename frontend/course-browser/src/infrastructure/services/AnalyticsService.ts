// src/infrastructure/services/AnalyticsService.ts

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export type ComputeSchedulePairsResponse = {
  top: Array<{
    score: number;
    totalOverlapMs: number;
    maxConcurrent: number;
    selection: Array<{
      courseInstanceId: string;
      courseCode: string;
      courseName: string;
      blockId: string;
      blockName: string;
      studyGroupId: string;
      studyGroupName: string;
    }>;
    durationByConcurrentMs?: Record<number, number>;
    segments?: Array<{
      startMs: number;
      endMs: number;
      concurrent: number;
      concurrentIds: string[];
    }>;
  }>;
  evaluated: number;
  totalPossible: number;
  capped: boolean;
  capCombinations: number;
  warnings: Array<{ code: string; message: string }>;
};

type ErrorResponse = {
  warnings?: Array<{ message?: string }>;
};

export async function fetchTopKSchedulePairs(
  payload: unknown
): Promise<ComputeSchedulePairsResponse> {
  const resp = await fetch(`${API_BASE}/api/analytics/schedule-pairs/topk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    let body: ErrorResponse | null = null;

    try {
      body = (await resp.json()) as ErrorResponse;
    } catch {
      // Response body is not JSON – ignore
    }

    throw new Error(
      body?.warnings?.[0]?.message ??
        `Analytics request failed (HTTP ${resp.status})`
    );
  }

  return resp.json() as Promise<ComputeSchedulePairsResponse>;
}
