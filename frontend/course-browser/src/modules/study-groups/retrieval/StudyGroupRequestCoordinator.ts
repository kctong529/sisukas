import {
  studyGroupKey,
  type StudyGroupRequest,
} from "./StudyGroupRequest";
import { StudyGroupRequestCancelledError } from "./StudyGroupRequestCancelledError";
import { StudyGroupRetrievalError } from "./StudyGroupRetrievalError";

import type { StudyGroup } from "../models/StudyGroup";
import type { StudyGroupOutcome } from "./StudyGroupOutcome";

export type StudyGroupBatchResult = Map<string, StudyGroup[]>;

export type StudyGroupTransport = (
  requests: StudyGroupRequest[],
) => Promise<StudyGroupBatchResult>;

export interface StudyGroupRequestCoordinatorOptions {
  transport: StudyGroupTransport;
  chunkSize?: number;
  concurrency?: number;
}

export interface StudyGroupLoadSettledOptions {
  onOutcome?: (
    key: string,
    outcome: StudyGroupOutcome,
  ) => void;
}

interface PendingRequest {
  request: StudyGroupRequest;
  key: string;
  generation: number;
  promise: Promise<StudyGroup[] | undefined>;
  resolve: (groups: StudyGroup[] | undefined) => void;
  reject: (reason: unknown) => void;
}

export class StudyGroupRequestCoordinator {
  private readonly transport: StudyGroupTransport;
  private readonly chunkSize: number;
  private readonly concurrency: number;

  private readonly inFlight = new Map<string, PendingRequest>();
  private readonly queue: PendingRequest[] = [];

  private activeBatches = 0;
  private dispatchScheduled = false;
  private generation = 0;

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
   * Retrieve offerings using one shared queue and global concurrency limit.
   *
   * Concurrent callers share queued and in-flight requests.
   * Completed results are not cached.
   */
  async load(
    requests: StudyGroupRequest[],
  ): Promise<StudyGroupBatchResult> {
    const entries = requests.map(async (request) => {
      const key = studyGroupKey(request);

      let pending = this.inFlight.get(key);

      if (!pending) {
        pending = this.createPendingRequest(request, key);
        this.inFlight.set(key, pending);
        this.queue.push(pending);
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

  /**
   * Retrieve offerings with independent success and failure outcomes.
   *
   * Reports each distinct offering as soon as its retrieval settles.
   * Shares queued and in-flight work with load().
   *
   * Cancellation rejects the operation rather than producing a failure
   * outcome. Observer exceptions never affect retrieval results.
   */
  async loadSettled(
    requests: StudyGroupRequest[],
    options: StudyGroupLoadSettledOptions = {},
  ): Promise<Map<string, StudyGroupOutcome>> {
    // Notify each offering at most once within this invocation.
    const uniqueRequests = new Map<string, StudyGroupRequest>();

    for (const request of requests) {
      const key = studyGroupKey(request);

      if (!uniqueRequests.has(key)) {
        uniqueRequests.set(key, request);
      }
    }

    const entries = await Promise.all(
      [...uniqueRequests].map(async ([key, request]) => {
        let outcome: StudyGroupOutcome;

        try {
          const result = await this.load([request]);
          const groups = result.get(key);

          if (groups === undefined) {
            throw new StudyGroupRetrievalError();
          }

          outcome = {
            status: "success",
            groups,
          };
        } catch (error) {
          if (error instanceof StudyGroupRequestCancelledError) {
            throw error;
          }

          outcome = {
            status: "failure",
            error:
              error instanceof Error
                ? error
                : new Error("Study-group retrieval failed"),
          };
        }

        // Notification failures must not become retrieval failures.
        if (options.onOutcome) {
          try {
            options.onOutcome(key, outcome);
          } catch {
            // Observers are isolated from coordinator execution.
          }
        }

        return [key, outcome] as const;
      }),
    );

    return new Map(entries);
  }

  /**
   * Logically cancel all outstanding work.
   *
   * Queued work is discarded. Running transports are not aborted,
   * and continue occupying concurrency slots until they settle.
   */
  clear(): void {
    this.generation++;
    this.queue.length = 0;

    const pending = [...this.inFlight.values()];
    this.inFlight.clear();

    for (const entry of pending) {
      entry.reject(new StudyGroupRequestCancelledError());
    }
  }

  private createPendingRequest(
    request: StudyGroupRequest,
    key: string,
  ): PendingRequest {
    let resolve!: PendingRequest["resolve"];
    let reject!: PendingRequest["reject"];

    const promise = new Promise<StudyGroup[] | undefined>(
      (res, rej) => {
        resolve = res;
        reject = rej;
      },
    );

    return {
      request,
      key,
      generation: this.generation,
      promise,
      resolve,
      reject,
    };
  }

  /**
   * Coalesce synchronous requests into the next microtask.
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
    batch: PendingRequest[],
  ): Promise<void> {
    try {
      const result = await this.transport(
        batch.map((entry) => entry.request),
      );

      for (const entry of batch) {
        if (this.isCurrent(entry)) {
          this.inFlight.delete(entry.key);

          if (!result.has(entry.key)) {
            entry.reject(new StudyGroupRetrievalError());
          } else {
            entry.resolve(result.get(entry.key));
          }
        }
      }
    } catch (error) {
      for (const entry of batch) {
        if (this.isCurrent(entry)) {
          this.inFlight.delete(entry.key);
          entry.reject(error);
        }
      }
    } finally {
      this.activeBatches--;

      if (this.queue.length > 0) {
        this.scheduleDispatch();
      }
    }
  }

  /**
   * Prevent an obsolete batch from settling a newer request
   * for the same offering key.
   */
  private isCurrent(entry: PendingRequest): boolean {
    return (
      entry.generation === this.generation &&
      this.inFlight.get(entry.key) === entry
    );
  }
}
