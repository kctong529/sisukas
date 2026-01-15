// src/infrastructure/services/StudyGroupService.ts

import type { StudyGroup } from '../../domain/models/StudyGroup';
import type { StudyEvent } from '../../domain/models/StudyEvent';

// ========== API Response Types ==========

interface SisuStudyEvent {
  start: string;
  end: string;
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
 * Service for fetching and transforming study group data from the SISU wrapper API.
 * Handles three endpoints:
 * 1. Single study groups fetch: GET /api/courses/study-groups
 * 2. Batch study groups fetch: POST /api/courses/batch/study-groups
 * 3. Batch course offerings fetch: POST /api/courses/batch/offerings
 */
export class StudyGroupService {
  private wrapperApiUrl: string;

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

  /**
   * Batch fetch study groups for multiple course instances (POST endpoint)
   * More efficient than multiple individual requests.
   * 
   * @param requests Array of course references (max 100)
   * @returns Map with key format "unitId:offeringId" -> StudyGroup[]
   */
  async fetchStudyGroupsBatch(
    requests: StudyGroupRequest[]
  ): Promise<Map<string, StudyGroup[]>> {
    try {
      if (requests.length === 0) {
        return new Map();
      }

      if (requests.length > 100) {
        throw new Error('Batch request exceeds maximum of 100 items');
      }

      const url = new URL(`${this.wrapperApiUrl}/api/courses/batch/study-groups`);
      
      const payload = {
        requests: requests.map(req => ({
          course_unit_id: req.courseUnitId,
          course_offering_id: req.courseOfferingId,
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

      const data: SisuBatchStudyGroupsResponse = await response.json();
      const results = new Map<string, StudyGroup[]>();

      for (const [key, sisuGroups] of Object.entries(data.results)) {
        results.set(key, this.transformStudyGroups(sisuGroups));
      }

      return results;
    } catch (error) {
      console.error('Error in batch study groups fetch:', error);
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
   * Transform SISU API response to domain models
   */
  private transformStudyGroups(sisuGroups: SisuStudyGroup[]): StudyGroup[] {
    return sisuGroups.map(group => ({
      groupId: group.group_id,
      name: group.name,
      type: group.type,
      studyEvents: this.transformStudyEvents(group.study_events),
    }));
  }

  /**
   * Transform study events from API format to domain model
   */
  private transformStudyEvents(sisuEvents: SisuStudyEvent[]): StudyEvent[] {
    return sisuEvents.map(event => ({
      start: event.start,
      end: event.end,
      location: undefined, // Not provided by current API
    }));
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