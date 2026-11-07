/**
 * Indicates that pending study-group retrieval was invalidated.
 *
 * Cancellation is logical: active transport requests may continue
 * running until their underlying operations settle.
 */
export class StudyGroupRequestCancelledError extends Error {
  constructor() {
    super("Study-group request cancelled");
    this.name = "StudyGroupRequestCancelledError";
  }
}
