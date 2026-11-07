import type { StudyGroup } from "@domain/models/StudyGroup";
import {
  studyGroupKey,
  type StudyGroupRequest,
} from "./StudyGroupRequest";

export type StudyGroupBatchResult = Map<string, StudyGroup[]>;

export type StudyGroupTransport = (
  requests: StudyGroupRequest[],
) => Promise<StudyGroupBatchResult>;

export interface StudyGroupRequestCoordinatorOptions {
  transport: StudyGroupTransport;
}

/**
 * Shares in-flight study-group requests across consumers.
 *
 * Does not cache completed results or schedule batches yet.
 * Those responsibilities will be introduced separately.
 */
export class StudyGroupRequestCoordinator {
  private readonly transport: StudyGroupTransport;

  private readonly inFlight = new Map<
    string,
    Promise<StudyGroup[] | undefined>
  >();

  constructor(options: StudyGroupRequestCoordinatorOptions) {
    this.transport = options.transport;
  }

  async load(
    requests: StudyGroupRequest[],
  ): Promise<StudyGroupBatchResult> {
    const entries = requests.map(async (request) => {
      const key = studyGroupKey(request);

      let pending = this.inFlight.get(key);

      if (!pending) {
        pending = this.fetchOne(request, key);
        this.inFlight.set(key, pending);
      }

      return [key, await pending] as const;
    });

    const resolved = await Promise.all(entries);
    const result: StudyGroupBatchResult = new Map();

    for (const [key, groups] of resolved) {
      if (groups !== undefined) {
        result.set(key, groups);
      }
    }

    return result;
  }

  private async fetchOne(
    request: StudyGroupRequest,
    key: string,
  ): Promise<StudyGroup[] | undefined> {
    try {
      const result = await this.transport([request]);
      return result.get(key);
    } finally {
      this.inFlight.delete(key);
    }
  }
}
