// src/infrastructure/services/StudyGroupService.ts

/**
 * Fetches and normalizes study group data from the SISU wrapper API.
 *
 * Endpoints:
 * - GET  /api/courses/study-groups            (single instance)
 * - POST /api/courses/batch/study-groups      (many instances; preferred)
 * - POST /api/courses/batch/offerings         (offerings + embedded study groups)
 *
 * Notes:
 * - Normalization preserves every upstream occurrence, including events sharing
 *   the same time slot, together with identity, status, and location metadata.
 * - Scheduling-specific time-slot aggregation belongs to analytics consumers,
 *   not this shared API adapter.
 * - Batch requests are deduplicated, chunked, and processed with limited
 *   concurrency to keep the UI responsive.
 */

import type { StudyGroup } from '../../domain/models/StudyGroup';
import type { StudyEvent } from '../../domain/models/StudyEvent';

// ========== API Response Types ==========

interface SisuStudyLocation {
  id: string;
  name: string;
  building_id?: string | null;
  building_name?: string | null;
  address?: string | null;
}

interface SisuStudyEvent {
  start: string;
  end: string;
  start_iso?: string | null;
  end_iso?: string | null;
  series_id?: string | null;
  cancelled?: boolean;
  excluded?: boolean;
  notice?: string | null;
  location_ids?: string[];
  locations?: SisuStudyLocation[];

  // Retained for compatibility with older responses.
  location?: string;
}

interface SisuStudyGroup {
  group_id: string;
  name: string;
  type: string;
  study_events: SisuStudyEvent[];
}

interface SisuStudyGroupsResponse {
  course_unit_id: string;
  course_offering_id: string;
  study_groups: SisuStudyGroup[];
}

interface SisuCourseOffering {
  course_unit_id: string;
  offering_id: string;
  name: string;
  assessment_items?: string[];
  study_groups?: SisuStudyGroup[];
}

interface SisuBatchStudyGroupsResponse {
  results: {
    [key: string]: SisuStudyGroup[]; // key: "unit_id:offering_id"
  };
  total_requests: number;
}

interface SisuBatchOfferingsResponse {
  results: {
    [key: string]: SisuCourseOffering; // key: "unit_id:offering_id"
  };
  total_requests: number;
}

// ========== Request Types ==========

export interface StudyGroupRequest {
  courseUnitId: string;
  courseOfferingId: string;
}

export interface BatchStudyGroupsRequest {
  requests: StudyGroupRequest[];
}

export interface BatchOfferingsRequest {
  requests: Array<{
    courseUnitId: string;
    offeringId: string;
  }>;
}

// ========== Response Types ==========

export interface CourseOfferingData {
  courseUnitId: string;
  offeringId: string;
  name: string;
  assessmentItems?: string[];
  studyGroups: StudyGroup[];
}

/**
 * Fetches study groups and converts wrapper responses into domain models.
 *
 * The single study-group, batch study-group, and batch offering endpoints all
 * use the same source-preserving normalization. In particular, events with
 * equal time ranges remain separate, so calendar consumers can distinguish
 * source series, cancellation notices, and resolved locations.
 *
 * Scheduling analytics can aggregate equal time slots downstream without
 * altering the data shared with other consumers.
 */
export class StudyGroupService {
  private wrapperApiUrl: string;

  private keyOf(r: StudyGroupRequest): string {
    return `${r.courseUnitId}:${r.courseOfferingId}`;
  }

  constructor(wrapperApiUrl: string) {
    this.wrapperApiUrl = wrapperApiUrl;
  }

  // ========== Single Endpoint ==========

  /**
   * Fetch study groups for a specific course instance (GET endpoint)
   * @param courseUnitId - The unit ID of the course
   * @param courseOfferingId - The offering ID of the course instance
   * @returns Array of StudyGroup domain models
   */
  async fetchStudyGroups(
    courseUnitId: string,
    courseOfferingId: string
  ): Promise<StudyGroup[]> {
    try {
      const url = new URL(`${this.wrapperApiUrl}/api/courses/study-groups`);
      url.searchParams.append('course_unit_id', courseUnitId);
      url.searchParams.append('course_offering_id', courseOfferingId);

      const response = await fetch(url.toString());
      if (!response.ok) {
        this.handleErrorResponse(response.status);
        return [];
      }

      const data: SisuStudyGroupsResponse = await response.json();
      return this.transformStudyGroups(data.study_groups);
    } catch (error) {
      console.error('Error fetching study groups:', error);
      return [];
    }
  }

  // ========== Batch Study Groups Endpoint ==========

  private async fetchStudyGroupsBatchOnce(
    requests: StudyGroupRequest[]
  ): Promise<Map<string, StudyGroup[]>> {
    if (requests.length === 0) return new Map();

    const url = new URL(`${this.wrapperApiUrl}/api/courses/batch/study-groups`);

    const payload = {
      requests: requests.map((req) => ({
        course_unit_id: req.courseUnitId,
        course_offering_id: req.courseOfferingId,
      })),
    };

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      this.handleErrorResponse(response.status);
      return new Map();
    }

    const data: SisuBatchStudyGroupsResponse = await response.json();
    const results = new Map<string, StudyGroup[]>();

    for (const [key, sisuGroups] of Object.entries(data.results)) {
      results.set(key, this.transformStudyGroups(sisuGroups));
    }

    return results;
  }

  async fetchStudyGroupsBatch(
    requests: StudyGroupRequest[],
    opts?: {
      chunkSize?: number;
      concurrency?: number;
      onProgress?: (p: { done: number; total: number }) => void;
      onChunk?: (res: Map<string, StudyGroup[]>) => void;
    }
  ): Promise<Map<string, StudyGroup[]>> {
    try {
      if (requests.length === 0) return new Map();

      // De-duplicate by (courseUnitId, courseOfferingId) to avoid redundant batch requests
      const uniq = new Map<string, StudyGroupRequest>();
      for (const r of requests) uniq.set(this.keyOf(r), r);
      const deduped = [...uniq.values()];

      // Clamp chunk size to keep each POST within backend limits
      const chunkSize = Math.min(Math.max(opts?.chunkSize ?? 50, 1), 50);

      // Limit parallel requests to avoid starving the browser or backend
      const concurrency = Math.min(Math.max(opts?.concurrency ?? 4, 1), 12);

      const chunks: StudyGroupRequest[][] = [];
      for (let i = 0; i < deduped.length; i += chunkSize) {
        chunks.push(deduped.slice(i, i + chunkSize));
      }

      const total = chunks.length;
      let done = 0;

      const merged = new Map<string, StudyGroup[]>();
      let nextIndex = 0;

      // Worker pulls the next chunk index atomically and processes it
      const runWorker = async () => {
        while (true) {
          const i = nextIndex++;
          if (i >= total) return;

          const res = await this.fetchStudyGroupsBatchOnce(chunks[i]);

          // emit partial results immediately
          opts?.onChunk?.(res);

          // still keep merged final map for callers who want it
          for (const [k, v] of res.entries()) merged.set(k, v);

          done++;
          opts?.onProgress?.({ done, total });

          // Yield to the event loop so rendering and input are not blocked
          await new Promise<void>((r) => setTimeout(r, 0));
        }
      };

      await Promise.all(Array.from({ length: Math.min(concurrency, total) }, runWorker));
      return merged;
    } catch (e) {
      console.error("Error in batch study groups fetch:", e);
      return new Map();
    }
  }


  // ========== Batch Offerings Endpoint ==========

  /**
   * Batch fetch complete course offerings including study groups (POST endpoint)
   * Returns full CourseOffering data with study groups included.
   *
   * @param requests Array of course references (max 100)
   * @returns Map with key format "unitId:offeringId" -> CourseOfferingData
   */
  async fetchOfferingsBatch(
    requests: Array<{ courseUnitId: string; offeringId: string }>
  ): Promise<Map<string, CourseOfferingData>> {
    try {
      if (requests.length === 0) {
        return new Map();
      }

      if (requests.length > 100) {
        throw new Error('Batch request exceeds maximum of 100 items');
      }

      const url = new URL(`${this.wrapperApiUrl}/api/courses/batch/offerings`);

      const payload = {
        requests: requests.map(req => ({
          course_unit_id: req.courseUnitId,
          offering_id: req.offeringId,
        })),
      };

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.handleErrorResponse(response.status);
        return new Map();
      }

      const data: SisuBatchOfferingsResponse = await response.json();
      const results = new Map<string, CourseOfferingData>();

      for (const [key, offering] of Object.entries(data.results)) {
        results.set(key, {
          courseUnitId: offering.course_unit_id,
          offeringId: offering.offering_id,
          name: offering.name,
          assessmentItems: offering.assessment_items,
          studyGroups: offering.study_groups
            ? this.transformStudyGroups(offering.study_groups)
            : [],
        });
      }

      return results;
    } catch (error) {
      console.error('Error in batch offerings fetch:', error);
      return new Map();
    }
  }

  // ========== Transform Methods ==========

  /**
   * Converts wrapper study groups into frontend domain models.
   *
   * Each group retains its source identifier, name, and activity type. Its
   * study events are normalized individually without time-slot deduplication.
   */
  private transformStudyGroups(sisuGroups: SisuStudyGroup[]): StudyGroup[] {
    return sisuGroups.map(group => ({
      groupId: group.group_id,
      name: group.name,
      type: group.type,
      studyEvents: this.transformStudyEvents(
        group.study_events,
        group.group_id
      ),
    }));
  }

  /**
   * Transforms SISU study events into frontend domain models.
   *
   * Unlike the previous time-slot deduplication, this transformation preserves
   * every source occurrence, including events with identical start/end times.
   * This ensures that distinct series, cancellations, and location metadata
   * remain available to calendar consumers.
   *
   * Transformation:
   * 1. Preserve source event order and individual occurrences.
   * 2. Map source identity, timestamps, status flags, and notices.
   * 3. Convert resolved location metadata to camelCase.
   * 4. Retain a display-friendly location string for existing consumers.
   * 5. Apply defaults for optional fields omitted by older API responses.
   *
   * The generated ID is a compatibility identifier, not a stable SISU
   * occurrence identity. Canonical calendar identity is handled separately.
   */
  private transformStudyEvents(
    sisuEvents: SisuStudyEvent[],
    groupId: string
  ): StudyEvent[] {
    return sisuEvents.map((event, index) => {
      const locations = (event.locations ?? []).map(loc => ({
        id: loc.id,
        name: loc.name,
        buildingId: loc.building_id ?? null,
        buildingName: loc.building_name ?? null,
        address: loc.address ?? null,
      }));

      const location =
        event.location?.trim() ||
        locations.map(loc => loc.name).join(', ') ||
        undefined;

      return {
        id: `${groupId}:${index}`,
        start: event.start,
        end: event.end,
        startIso: event.start_iso ?? undefined,
        endIso: event.end_iso ?? undefined,
        seriesId: event.series_id ?? null,
        cancelled: event.cancelled ?? false,
        excluded: event.excluded ?? false,
        notice: event.notice ?? null,
        locationIds: [...(event.location_ids ?? [])],
        locations,
        location,
      };
    });
  }

  // ========== Error Handling ==========

  /**
   * Handle HTTP error responses from the API
   */
  private handleErrorResponse(status: number): void {
    const errorMessages: { [key: number]: string } = {
      404: 'Course not found',
      422: 'Invalid request format',
      500: 'Internal server error',
      502: 'Sisu API unavailable',
      504: 'Sisu API timeout',
    };

    const message = errorMessages[status] || `HTTP ${status} error`;
    console.error(`Study Group Service error: ${message}`);
  }
}
