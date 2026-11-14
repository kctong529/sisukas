import { describe, expect, it } from "vitest";

import { buildAnalyticsPayload } from "@application/analytics/buildAnalyticsPayload";

import type { Block } from "@domain/models/Block";
import type { Course } from "@domain/models/Course";
import type { StudyGroup } from "@modules/study-groups";

describe("buildAnalyticsPayload", () => {
  it("aggregates equal-time source events for scheduling", () => {
    const instanceId = "offering-1";
    const unitId = "course-unit-1";

    const groups: StudyGroup[] = [
      {
        groupId: "group-1",
        name: "L01",
        type: "Lecture",
        studyEvents: [
          {
            id: "group-1:0",
            seriesId: "series-A",
            start: "2026-11-02T10:00:00",
            end: "2026-11-02T12:00:00",
            cancelled: false,
            excluded: false,
            locationIds: ["room-A"],
            locations: [],
            location: "Room A",
          },
          {
            id: "group-1:1",
            seriesId: "series-B",
            start: "2026-11-02T10:00:00",
            end: "2026-11-02T12:00:00",
            cancelled: false,
            excluded: false,
            locationIds: ["room-B"],
            locations: [],
            location: "Room B",
          },
        ],
      },
    ];

    // Minimal fixtures containing the fields used by the builder.
    const course = {
      id: instanceId,
      unitId,
      code: { value: "TEST-C1000" },
      name: { en: "Test Course" },
    } as Course;

    const block = {
      id: "block-1",
      label: "Lectures",
      studyGroupIds: ["group-1"],
    } as Block;

    const result = buildAnalyticsPayload({
      instanceIds: [instanceId],
      getCourseForInstance: id =>
        id === instanceId ? course : undefined,
      getBlocksForInstance: id =>
        id === instanceId ? [block] : [],
      getStudyGroupsForInstance: (cu, co) =>
        cu === unitId && co === instanceId ? groups : null,
    });

    const events =
      result.courseInstances[0].blocks[0].studyGroups[0].events;

    // Two source occurrences become one analytics time slot.
    expect(groups[0].studyEvents).toHaveLength(2);
    expect(events).toHaveLength(1);

    expect(events[0]).toEqual({
      eventId: "group-1:0",
      start: "2026-11-02T10:00:00",
      end: "2026-11-02T12:00:00",
      location: "Room A, Room B",
    });

    // The original source records remain unchanged.
    expect(groups[0].studyEvents.map(e => e.seriesId))
      .toEqual(["series-A", "series-B"]);

    expect(groups[0].studyEvents.map(e => e.location))
      .toEqual(["Room A", "Room B"]);
  });
});
