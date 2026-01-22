import type { ComputeSchedulePairsResponse } from "../../infrastructure/services/AnalyticsService";
import type { AnalyticsResponse, ScheduleCandidate, Segment } from "../types/analytics";

type UiWarning = AnalyticsResponse["warnings"][number];
type UiWarningCode = UiWarning["code"];

const UI_WARNING_CODES = new Set<UiWarningCode>([
  "CAP_REACHED",
  "EMPTY_INPUT",
  "INVALID_INPUT",
]);

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null;
}

function getNumberField(obj: unknown, key: string): number | undefined {
  if (!isRecord(obj)) return undefined;
  const v = obj[key];
  return typeof v === "number" ? v : undefined;
}

function getBooleanField(obj: unknown, key: string): boolean | undefined {
  if (!isRecord(obj)) return undefined;
  const v = obj[key];
  return typeof v === "boolean" ? v : undefined;
}

function normalizeWarnings(
  warnings: Array<{ code: string; message: string }> | undefined
): UiWarning[] {
  if (!warnings?.length) return [];
  return warnings.map((w) => ({
    code: UI_WARNING_CODES.has(w.code as UiWarningCode)
      ? (w.code as UiWarningCode)
      : "INVALID_INPUT",
    message: w.message,
  }));
}

function normalizeSegments(
  segs:
    | Array<{
        startMs: number;
        endMs: number;
        concurrent: number;
        concurrentIds?: string[];
      }>
    | undefined
): Segment[] {
  if (!segs?.length) return [];
  return segs.map((s) => ({
    startMs: s.startMs,
    endMs: s.endMs,
    concurrent: s.concurrent,
    concurrentIds: s.concurrentIds ?? [],
  }));
}

export function normalizeComputeSchedulePairsResponse(
  resp: ComputeSchedulePairsResponse
): AnalyticsResponse {
  // backend might include these, even if ComputeSchedulePairsResponse doesn't model them yet
  const evaluated = getNumberField(resp, "evaluated") ?? (resp.top?.length ?? 0);
  const totalPossible = getNumberField(resp, "totalPossible") ?? evaluated;
  const capped = getBooleanField(resp, "capped") ?? false;
  const capCombinations = getNumberField(resp, "capCombinations") ?? 0;

  return {
    warnings: normalizeWarnings(resp.warnings),
    evaluated,
    totalPossible,
    capped,
    capCombinations,
    top: (resp.top ?? []).map(
      (c): ScheduleCandidate => ({
        score: c.score,
        totalOverlapMs: c.totalOverlapMs,
        maxConcurrent: c.maxConcurrent,
        selection: c.selection,
        durationByConcurrentMs: c.durationByConcurrentMs ?? {},
        segments: normalizeSegments(c.segments),
      })
    ),
  };
}
