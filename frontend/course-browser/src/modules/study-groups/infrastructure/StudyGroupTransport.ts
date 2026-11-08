import type {
  StudyGroupTransport,
} from "../retrieval/StudyGroupRequestCoordinator";
import { StudyGroupService } from "./StudyGroupService";

/**
 * Adapt the existing SISU wrapper service to the coordinator's
 * transport contract.
 *
 * Each invocation represents one coordinator-controlled batch.
 * Chunking, concurrency, deduplication, and retries belong to
 * the coordinator or higher application layers.
 */
export function createStudyGroupTransport(
  service: StudyGroupService,
): StudyGroupTransport {
  return (requests) =>
    service.fetchStudyGroupsChunk(requests);
}
