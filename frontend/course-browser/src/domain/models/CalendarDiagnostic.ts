/** A source reference for explaining calendar data problems without inventing IDs. */
export interface CalendarSourceContext {
  courseOfferingId?: string;
  studyGroupId?: string;
  seriesId?: string | null;
}

/** Shared calendar diagnostic codes. Extend this union for projection errors in #138. */
export type CalendarDiagnosticCode =
  | "missing_offset_timestamp"
  | "invalid_offset_timestamp"
  | "invalid_interval"
  | "local_timestamp_mismatch"
  | "invalid_local_timestamp"
  | "missing_series_identity"
  | "occurrence_key_collision"
  | "missing_course_offering"
  | "study_groups_missing"
  | "study_groups_loading"
  | "study_groups_failed"
  | "study_groups_stale"
  | "selected_study_group_missing"
  | "excluded_occurrence";

export interface CalendarDiagnostic {
  severity: "error" | "warning";
  code: CalendarDiagnosticCode;
  field?: "start" | "end";
  source?: CalendarSourceContext;
  message: string;
}
