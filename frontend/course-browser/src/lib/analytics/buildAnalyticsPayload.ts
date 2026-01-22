// src/lib/analytics/buildAnalyticsPayload.ts

import type { Course } from "../../domain/models/Course";
import type { Block } from "../../domain/models/Block";
import type { StudyGroup } from "../../domain/models/StudyGroup";

/* ========= Backend request DTO ========= */

export type ComputeSchedulePairsRequest = {
  topK?: number;
  capCombinations?: number;
  scoreMode?: "minOverlap" | "minMaxConcurrentThenOverlap";
  include?: {
    durationByConcurrentMs?: boolean;
    segments?: boolean;
  };
  courseInstances: CourseInstanceInput[];
};

type CourseInstanceInput = {
  courseInstanceId: string;
  courseCode: string;
  name: string;
  blocks: BlockInput[];
};

type BlockInput = {
  blockId: string;
  name: string;
  studyGroups: StudyGroupInput[];
};

type StudyGroupInput = {
  studyGroupId: string;
  name: string;
  events: StudyEventInput[];
};

type StudyEventInput = {
  eventId: string;
  start: string;
  end: string;
  location?: string;
};

/* ========= Main builder ========= */

/**
 * Build request payload for:
 * POST /api/analytics/schedule-pairs/topk
 *
 * Params:
 * - instanceIds: course instance IDs to include
 * - getCourseForInstance: lookup function for course data
 * - getBlocksForInstance: lookup function for blocks
 * - getStudyGroupsForInstance: lookup function for study groups
 * - topK: number of results to return (default: 20)
 * - capCombinations: safety cap on enumeration (default: 100_000)
 * - scoreMode: ranking strategy (default: "minOverlap")
 * - includeSegments: request timeline decomposition for heatmaps (default: true)
 * - includeDurationHistogram: request duration histogram (default: false)
 */
export function buildAnalyticsPayload(params: {
  instanceIds: string[];
  getCourseForInstance: (id: string) => Course | undefined;
  getBlocksForInstance: (id: string) => Block[];
  getStudyGroupsForInstance: (courseUnitId: string, courseOfferingId: string) => StudyGroup[] | null;
  topK?: number;
  capCombinations?: number;
  scoreMode?: "minOverlap" | "minMaxConcurrentThenOverlap";
  includeSegments?: boolean;
  includeDurationHistogram?: boolean;
}): ComputeSchedulePairsRequest {
  const {
    instanceIds,
    getCourseForInstance,
    getBlocksForInstance,
    getStudyGroupsForInstance,
    topK = 20,
    capCombinations = 100_000,
    scoreMode = "minOverlap",
    includeSegments = true,
    includeDurationHistogram = false,
  } = params;

  const courseInstances: CourseInstanceInput[] = [];

  for (const instanceId of instanceIds) {
    const course = getCourseForInstance(instanceId);
    if (!course) continue;

    // NOTE: your store key is unitId:offeringId, so use those.
    const allStudyGroups = getStudyGroupsForInstance(course.unitId, instanceId) ?? [];
    const blocks = getBlocksForInstance(instanceId);

    const blocksInput: BlockInput[] = blocks.map((blk) => {
      const groupsInBlock = allStudyGroups.filter((sg) =>
        blk.studyGroupIds.includes(sg.groupId)
      );

      const studyGroupsInput: StudyGroupInput[] = groupsInBlock.map((sg) => ({
        studyGroupId: sg.groupId,
        name: sg.name,
        events: sg.studyEvents.map((ev, i) => ({
          eventId: `${sg.groupId}:${i}`,
          start: ev.startIso ?? ev.start,
          end: ev.endIso ?? ev.end,
          location: ev.location,
        })),
      }));

      return {
        blockId: blk.id ?? blk.label,
        name: blk.label,
        studyGroups: studyGroupsInput,
      };
    });

    courseInstances.push({
      courseInstanceId: instanceId,
      courseCode: course.code.value,
      name: course.name.en ?? course.code.value,
      blocks: blocksInput,
    });
  }

  return {
    topK,
    capCombinations,
    scoreMode,
    include: {
      segments: includeSegments,
      durationByConcurrentMs: includeDurationHistogram,
    },
    courseInstances,
  };
}