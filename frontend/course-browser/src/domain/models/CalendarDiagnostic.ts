/** A source reference for explaining calendar data problems without inventing IDs. */
export interface CalendarSourceContext {
  courseInstanceId?: string;
  studyGroupId?: string;
  seriesId?: string | null;
}

/** Diagnostic codes introduced by the temporal and identity contracts in #137. */
export type CalendarDiagnosticCode =
  | "missing_offset_timestamp"
  | "invalid_offset_timestamp"
  | "invalid_interval"
  | "local_timestamp_mismatch"
  | "invalid_local_timestamp"
  | "missing_series_identity"
  | "occurrence_key_collision";

/** Backwards-compatible alias for the Stage 1 temporal diagnostics. */
export type CalendarTimeDiagnosticCode = CalendarDiagnosticCode;

export interface CalendarDiagnostic {
  severity: "error" | "warning";
  code: CalendarDiagnosticCode;
  field?: "start" | "end";
  source?: CalendarSourceContext;
  message: string;
}
