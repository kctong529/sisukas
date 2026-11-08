/**
 * Public API for study-group data management.
 *
 * Consumers should import from this entry point instead of
 * depending on internal cache, retrieval, or infrastructure
 * implementations.
 */

// Source-data contracts
export type {
  StudyEvent,
  StudyLocation,
} from "./models/StudyEvent";

export type {
  StudyGroup,
} from "./models/StudyGroup";

// Runtime input and observable state contracts
export type {
  StudyGroupRequest,
} from "./retrieval/StudyGroupRequest";

export type {
  StudyGroupEntry,
  StudyGroupLoadStatus,
} from "./cache/StudyGroupEntry";

// Shared runtime facade
export type {
  StudyGroupDataRuntime,
} from "./StudyGroupDataRuntime";

export {
  getStudyGroupDataRuntime,
} from "./StudyGroupDataRuntime";
