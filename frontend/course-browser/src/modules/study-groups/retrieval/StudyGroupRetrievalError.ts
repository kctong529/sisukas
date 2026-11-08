/**
 * Indicates that a transport response did not include a requested offering.
 *
 * This error describes an incomplete retrieval response, not a successful
 * offering with zero study groups.
 */
export class StudyGroupRetrievalError extends Error {
  constructor() {
    super("Study-group response omitted a requested offering");
    this.name = "StudyGroupRetrievalError";
  }
}
