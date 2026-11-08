import { afterEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";

import type { StudyGroupRequest } from
  "@application/studyGroups/StudyGroupRequest";
import { StudyGroupService } from
  "@infrastructure/services/StudyGroupService";
import { createStudyGroupDataRuntime } from
  "@infrastructure/studyGroups/StudyGroupDataRuntime";

const API = "https://wrapper.example.test";

const offeringA: StudyGroupRequest = {
  courseUnitId: "unit-a",
  courseOfferingId: "offering-a",
};

const offeringB: StudyGroupRequest = {
  courseUnitId: "unit-b",
  courseOfferingId: "offering-b",
};

const keyA = "unit-a:offering-a";
const keyB = "unit-b:offering-b";

function response(
  body: unknown,
  status = 200,
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function batchBody(
  key: string,
  groups: unknown[],
) {
  return {
    total_requests: 1,
    results: {
      [key]: groups,
    },
  };
}

function sourceGroup(
  id: string,
  events: unknown[] = [],
) {
  return {
    group_id: id,
    name: `Group ${id}`,
    type: "Lecture",
    study_events: events,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((fulfill) => {
    resolve = fulfill;
  });

  return { promise, resolve };
}

function createRuntime(options?: {
  chunkSize?: number;
  concurrency?: number;
}) {
  return createStudyGroupDataRuntime({
    service: new StudyGroupService(API),
    now: () => 1_000,
    ...options,
  });
}

function requestedKey(init: RequestInit | undefined): string {
  if (typeof init?.body !== "string") {
    throw new Error("Expected a JSON request body");
  }

  const body = JSON.parse(init.body) as {
    requests: Array<{
      course_unit_id: string;
      course_offering_id: string;
    }>;
  };

  expect(body.requests).toHaveLength(1);

  const [request] = body.requests;

  return `${request.course_unit_id}:${request.course_offering_id}`;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("StudyGroupDataRuntime HTTP integration", () => {
  it("preserves source identity, timestamps, and locations", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockResolvedValue(
      response(
        batchBody(keyA, [
          sourceGroup("group-1", [
            {
              start: "2026-11-02T10:15:00",
              end: "2026-11-02T12:00:00",
              start_iso: "2026-11-02T10:15:00+02:00",
              end_iso: "2026-11-02T12:00:00+02:00",
              series_id: "series-1",
              cancelled: false,
              excluded: false,
              location_ids: ["room-1"],
              locations: [{
                id: "room-1",
                name: "Lecture Hall",
                building_id: "building-1",
                building_name: "Main Building",
                address: "Example Street 1",
              }],
            },
            {
              start: "2026-11-02T10:15:00",
              end: "2026-11-02T12:00:00",
              start_iso: "2026-11-02T10:15:00+02:00",
              end_iso: "2026-11-02T12:00:00+02:00",
              series_id: "series-2",
              cancelled: true,
              excluded: false,
              notice: "Cancelled",
              location_ids: ["room-2"],
              locations: [{
                id: "room-2",
                name: "Other Room",
              }],
            },
          ]),
        ]),
      ),
    );

    const runtime = createRuntime();

    const entry = runtime.entry(offeringA);
    const states: string[] = [];

    const unsubscribe = entry.subscribe((value) => {
      states.push(value.status);
    });

    try {
      await runtime.ensure([offeringA]);

      expect(states).toEqual([
        "missing",
        "loading",
        "ready",
      ]);

      const snapshot = get(entry);

      expect(snapshot).toMatchObject({
        status: "ready",
        fetchedAt: 1_000,
        refreshing: false,
        error: null,
      });

      expect(snapshot.groups).toHaveLength(1);

      const events = snapshot.groups?.[0].studyEvents;

      // Equal time intervals must not collapse distinct
      // upstream source occurrences.
      expect(events).toHaveLength(2);

      expect(events?.map((event) => event.seriesId)).toEqual([
        "series-1",
        "series-2",
      ]);

      expect(events?.map((event) => event.id)).toEqual([
        "group-1:0",
        "group-1:1",
      ]);

      expect(events?.[0]).toMatchObject({
        start: "2026-11-02T10:15:00",
        end: "2026-11-02T12:00:00",
        startIso: "2026-11-02T10:15:00+02:00",
        endIso: "2026-11-02T12:00:00+02:00",
        seriesId: "series-1",
        locationIds: ["room-1"],
        location: "Lecture Hall",
        locations: [{
          id: "room-1",
          name: "Lecture Hall",
          buildingId: "building-1",
          buildingName: "Main Building",
          address: "Example Street 1",
        }],
      });

      expect(events?.[1]).toMatchObject({
        seriesId: "series-2",
        cancelled: true,
        excluded: false,
        notice: "Cancelled",
        locationIds: ["room-2"],
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, init] = fetchMock.mock.calls[0];

      expect(String(url)).toBe(
        `${API}/api/courses/batch/study-groups` +
          "?resolve_locations=true",
      );
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({
        "Content-Type": "application/json",
      });

      expect(JSON.parse(init?.body as string)).toEqual({
        requests: [{
          course_unit_id: "unit-a",
          course_offering_id: "offering-a",
        }],
      });
    } finally {
      unsubscribe();
    }
  });

  it("updates one offering before another HTTP batch finishes", async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();

    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockImplementation((_url, init) => {
      const key = requestedKey(init);

      if (key === keyA) return first.promise;
      if (key === keyB) return second.promise;

      throw new Error(`Unexpected offering: ${key}`);
    });

    const runtime = createRuntime({
      chunkSize: 1,
      concurrency: 2,
    });

    const entryA = runtime.entry(offeringA);
    const entryB = runtime.entry(offeringB);

    const observedA: string[] = [];
    const observedB: string[] = [];

    const unsubscribeA = entryA.subscribe((entry) => {
      observedA.push(entry.status);
    });

    const unsubscribeB = entryB.subscribe((entry) => {
      observedB.push(entry.status);
    });

    try {
      const loading = runtime.ensure([
        offeringA,
        offeringB,
      ]);

      await vi.waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(2);
      });

      first.resolve(
        response(batchBody(keyA, [
          sourceGroup("lecture-a"),
        ])),
      );

      await vi.waitFor(() => {
        expect(get(entryA).status).toBe("ready");
      });

      // Offering B has not finished yet.
      expect(get(entryB).status).toBe("loading");

      expect(get(entryA).groups?.[0].groupId).toBe(
        "lecture-a",
      );

      expect(observedA).toEqual([
        "missing",
        "loading",
        "ready",
      ]);

      expect(observedB).toEqual([
        "missing",
        "loading",
      ]);

      second.resolve(
        response(batchBody(keyB, [
          sourceGroup("lecture-b"),
        ])),
      );

      await loading;

      expect(get(entryB).status).toBe("ready");
      expect(get(entryB).groups?.[0].groupId).toBe(
        "lecture-b",
      );
    } finally {
      unsubscribeA();
      unsubscribeB();
    }
  });

  it("isolates HTTP failures without fabricating empty data", async () => {
    const runtime = createRuntime({
      chunkSize: 1,
      concurrency: 2,
    });

    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock.mockImplementation(async (_url, init) => {
      const key = requestedKey(init);

      if (key === keyA) {
        return response(
          batchBody(keyA, [sourceGroup("lecture-a")]),
        );
      }

      if (key === keyB) {
        return response(
          { detail: "Upstream unavailable" },
          502,
        );
      }

      throw new Error(`Unexpected offering: ${key}`);
    });

    await runtime.ensure([offeringA, offeringB]);

    expect(get(runtime.entry(offeringA))).toMatchObject({
      status: "ready",
      groups: [{
        groupId: "lecture-a",
      }],
      error: null,
    });

    expect(get(runtime.entry(offeringB))).toMatchObject({
      status: "failed",
      groups: null,
      fetchedAt: null,
      refreshing: false,
    });

    expect(get(runtime.entry(offeringB)).error).toContain(
      "HTTP 502",
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("caches successful empty results without refetching", async () => {
    const fetchMock = vi.spyOn(
      globalThis,
      "fetch",
    ).mockResolvedValue(
      response(batchBody(keyA, [])),
    );

    const runtime = createRuntime();

    await runtime.ensure([offeringA]);

    expect(get(runtime.entry(offeringA))).toEqual({
      groups: [],
      status: "ready",
      fetchedAt: 1_000,
      error: null,
      refreshing: false,
    });

    await runtime.ensure([offeringA]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
