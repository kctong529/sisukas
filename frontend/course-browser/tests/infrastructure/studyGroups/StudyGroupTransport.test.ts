import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { StudyGroupRequest } from "@modules/study-groups/retrieval/StudyGroupRequest";
import { studyGroupKey } from "@modules/study-groups/retrieval/StudyGroupRequest";
import { StudyGroupService } from "@modules/study-groups/infrastructure/StudyGroupService";
import { createStudyGroupTransport } from "@modules/study-groups/infrastructure/StudyGroupTransport";

const API = "https://wrapper.example.test";

const offeringA: StudyGroupRequest = {
  courseUnitId: "course-unit-a",
  courseOfferingId: "offering-a",
};

const offeringB: StudyGroupRequest = {
  courseUnitId: "course-unit-b",
  courseOfferingId: "offering-b",
};

const keyA = studyGroupKey(offeringA);
const keyB = studyGroupKey(offeringB);

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function batchBody(
  results: Record<string, unknown>,
): unknown {
  return {
    total_requests: Object.keys(results).length,
    results,
  };
}

function sourceGroup() {
  return {
    group_id: "lecture-1",
    name: "Lecture 1",
    type: "Lecture",
    study_events: [],
  };
}

function transport() {
  const service = new StudyGroupService(API);
  return createStudyGroupTransport(service);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("StudyGroupTransport", () => {
  it("sends one HTTP POST for one coordinator batch", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValue(response(batchBody({
        [keyA]: [sourceGroup()],
        [keyB]: [],
      })));

    const retrieve = transport();

    const result = await retrieve([offeringA, offeringB]);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0];

    expect(String(url)).toBe(
      `${API}/api/courses/batch/study-groups?resolve_locations=true`,
    );

    expect(options?.method).toBe("POST");
    expect(options?.headers).toEqual({
      "Content-Type": "application/json",
    });

    expect(JSON.parse(options?.body as string)).toEqual({
      requests: [
        {
          course_unit_id: "course-unit-a",
          course_offering_id: "offering-a",
        },
        {
          course_unit_id: "course-unit-b",
          course_offering_id: "offering-b",
        },
      ],
    });

    expect(result.size).toBe(2);
    expect(result.get(keyA)?.[0].groupId).toBe("lecture-1");
    expect(result.get(keyB)).toEqual([]);
  });

  it("preserves source events and location metadata", async () => {
    const source = {
      group_id: "lecture-1",
      name: "Lecture 1",
      type: "Lecture",
      study_events: [
        {
          start: "2026-11-09T10:00:00",
          end: "2026-11-09T12:00:00",
          start_iso: "2026-11-09T10:00:00+02:00",
          end_iso: "2026-11-09T12:00:00+02:00",
          series_id: "series-1",
          cancelled: true,
          excluded: false,
          notice: "Moved",
          location_ids: ["room-1"],
          locations: [
            {
              id: "room-1",
              name: "Hall 1",
              building_id: "building-1",
              building_name: "Main building",
            },
          ],
        },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      response(batchBody({ [keyA]: [source] })),
    );

    const result = await transport()([offeringA]);
    const groups = result.get(keyA);

    expect(groups).toHaveLength(1);
    expect(groups?.[0]).toMatchObject({
      groupId: "lecture-1",
      name: "Lecture 1",
      type: "Lecture",
    });

    expect(groups?.[0].studyEvents[0]).toMatchObject({
      start: "2026-11-09T10:00:00",
      end: "2026-11-09T12:00:00",
      startIso: "2026-11-09T10:00:00+02:00",
      endIso: "2026-11-09T12:00:00+02:00",
      seriesId: "series-1",
      cancelled: true,
      excluded: false,
      notice: "Moved",
      locationIds: ["room-1"],
      locations: [
        {
          id: "room-1",
          name: "Hall 1",
          buildingId: "building-1",
          buildingName: "Main building",
        },
      ],
    });
  });

  it("preserves explicitly empty study-group results", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      response(batchBody({ [keyA]: [] })),
    );

    const result = await transport()([offeringA]);

    expect(result.has(keyA)).toBe(true);
    expect(result.get(keyA)).toEqual([]);
  });

  it("does not fabricate results for omitted offerings", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      response(batchBody({
        [keyA]: [sourceGroup()],
      })),
    );

    const result = await transport()([
      offeringA,
      offeringB,
    ]);

    expect(result.has(keyA)).toBe(true);
    expect(result.has(keyB)).toBe(false);
  });

  it("propagates HTTP failures instead of returning an empty map", async () => {
    for (const status of [422, 502]) {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        response({}, status),
      );

      await expect(
        transport()([offeringA]),
      ).rejects.toThrow(String(status));
    }
  });

  it("propagates network and malformed-response failures", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce(
        response({ unexpected: "response" }),
      );

    const retrieve = transport();

    await expect(
      retrieve([offeringA]),
    ).rejects.toThrow("Network unavailable");

    await expect(
      retrieve([offeringA]),
    ).rejects.toThrow();
  });

  it("rejects oversized batches without splitting them", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const requests: StudyGroupRequest[] = Array.from(
      { length: 51 },
      (_, index) => ({
        courseUnitId: `unit-${index}`,
        courseOfferingId: `offering-${index}`,
      }),
    );

    await expect(
      transport()(requests),
    ).rejects.toThrow(/50/);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns an empty map without HTTP for an empty batch", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const result = await transport()([]);

    expect(result).toEqual(new Map());
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
