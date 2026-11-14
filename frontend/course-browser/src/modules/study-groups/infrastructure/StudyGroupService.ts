/**
 * Strict single-chunk transport adapter for the SISU wrapper's study-group API.
 *
 * The request coordinator owns deduplication, chunking, concurrency and retries.
 * This service performs at most one HTTP request and preserves every upstream
 * study event, including occurrences sharing the same time slot.
 */

import type { StudyEvent } from '../models/StudyEvent';
import type { StudyGroup } from '../models/StudyGroup';

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

interface SisuBatchStudyGroupsResponse {
  results: {
    [key: string]: SisuStudyGroup[]; // key: "unit_id:offering_id"
  };
  total_requests: number;
}

// ========== Request Types ==========

export interface StudyGroupRequest {
  courseUnitId: string;
  courseOfferingId: string;
}

/** Normalizes source study groups without scheduling or caching requests. */
export class StudyGroupService {
  private wrapperApiUrl: string;

  constructor(wrapperApiUrl: string) {
    this.wrapperApiUrl = wrapperApiUrl;
  }

  /**
   * Fetches and normalizes one coordinator-sized batch (at most 50 offerings).
   * Empty input does not trigger a request; transport and response failures throw.
   */
  async fetchStudyGroupsChunk(
    requests: StudyGroupRequest[],
  ): Promise<Map<string, StudyGroup[]>> {
    if (requests.length === 0) return new Map();

    if (requests.length > 50) {
      throw new RangeError("Study-group batch exceeds maximum of 50 requests");
    }

    const url = new URL(`${this.wrapperApiUrl}/api/courses/batch/study-groups`);
    url.searchParams.set('resolve_locations', 'true');

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
      throw new Error(`HTTP ${response.status} while fetching study groups`);
    }

    const data: SisuBatchStudyGroupsResponse = await response.json();
    if (
      !data ||
      typeof data !== 'object' ||
      !data.results ||
      typeof data.results !== 'object' ||
      Array.isArray(data.results)
    ) {
      throw new Error('Invalid study-group batch response');
    }

    for (const groups of Object.values(data.results)) {
      if (!Array.isArray(groups)) {
        throw new Error('Invalid study-group batch result');
      }
    }

    const results = new Map<string, StudyGroup[]>();

    for (const [key, sisuGroups] of Object.entries(data.results)) {
      results.set(key, this.transformStudyGroups(sisuGroups));
    }

    return results;
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
}
