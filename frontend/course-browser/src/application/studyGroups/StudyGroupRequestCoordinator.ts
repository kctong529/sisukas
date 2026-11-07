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
  chunkSize?: number;
  concurrency?: number;
}

interface PendingRequest {
  promise: Promise<StudyGroup[] | undefined>;
  resolve: (groups: StudyGroup[] | undefined) => void;
  reject: (reason: unknown) => void;
}

export class StudyGroupRequestCoordinator {
  private readonly transport: StudyGroupTransport;
  private readonly chunkSize: number;
  private readonly concurrency: number;

  private readonly inFlight = new Map<string, PendingRequest>();
  private readonly queue: StudyGroupRequest[] = [];

  private activeBatches = 0;
  private dispatchScheduled = false;

  constructor(options: StudyGroupRequestCoordinatorOptions) {
    const { transport, chunkSize = 20, concurrency = 2 } = options;

    if (!Number.isSafeInteger(chunkSize) || chunkSize < 1) {
      throw new RangeError("chunkSize must be a positive integer");
    }

    if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
      throw new RangeError("concurrency must be a positive integer");
    }

    this.transport = transport;
    this.chunkSize = chunkSize;
    this.concurrency = concurrency;
  }

  /**
   * Retrieve offerings using one shared queue and concurrency limit.
   *
   * Concurrent callers requesting the same offering share pending work.
   * Completed results are not cached by this coordinator.
   */
  async load(
    requests: StudyGroupRequest[],
  ): Promise<StudyGroupBatchResult> {
    const entries = requests.map(async (request) => {
      const key = studyGroupKey(request);

      let pending = this.inFlight.get(key);

      if (!pending) {
        pending = this.createPendingRequest();
        this.inFlight.set(key, pending);
        this.queue.push(request);
      }

      return [key, await pending.promise] as const;
    });

    if (this.queue.length > 0) {
      this.scheduleDispatch();
    }

    const resolved = await Promise.all(entries);
    const result: StudyGroupBatchResult = new Map();

    for (const [key, groups] of resolved) {
      if (groups !== undefined) {
        result.set(key, groups);
      }
    }

    return result;
  }

  private createPendingRequest(): PendingRequest {
    let resolve!: PendingRequest["resolve"];
    let reject!: PendingRequest["reject"];

    const promise = new Promise<StudyGroup[] | undefined>(
      (res, rej) => {
        resolve = res;
        reject = rej;
      },
    );

    return { promise, resolve, reject };
  }

  /**
   * Coalesce synchronous load() calls into the next microtask.
   */
  private scheduleDispatch(): void {
    if (this.dispatchScheduled) {
      return;
    }

    this.dispatchScheduled = true;

    void Promise.resolve().then(() => {
      this.dispatchScheduled = false;
      this.dispatch();
    });
  }

  /**
   * Start as many queued batches as the global limit permits.
   */
  private dispatch(): void {
    while (
      this.activeBatches < this.concurrency &&
      this.queue.length > 0
    ) {
      const batch = this.queue.splice(0, this.chunkSize);
      this.activeBatches++;

      void this.runBatch(batch);
    }
  }

  private async runBatch(
    requests: StudyGroupRequest[],
  ): Promise<void> {
    try {
      const result = await this.transport(requests);

      for (const request of requests) {
        const key = studyGroupKey(request);
        const pending = this.inFlight.get(key);

        if (pending) {
          this.inFlight.delete(key);
          pending.resolve(result.get(key));
        }
      }
    } catch (error) {
      for (const request of requests) {
        const key = studyGroupKey(request);
        const pending = this.inFlight.get(key);

        if (pending) {
          this.inFlight.delete(key);
          pending.reject(error);
        }
      }
    } finally {
      this.activeBatches--;

      if (this.queue.length > 0) {
        this.scheduleDispatch();
      }
    }
  }
}
