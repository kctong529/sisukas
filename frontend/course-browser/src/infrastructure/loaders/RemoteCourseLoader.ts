// src/infrastructure/loaders/RemoteCourseLoader.ts

import type { Course } from '../../domain/models/Course';
import { type RawCourse, parseRawCourse } from '../../domain/parsers/CourseParser';
import { LargeFileCache } from '../services/LargeFileCache';
const cache = new LargeFileCache();

// --- Configuration (Infrastructure) ---
// Using environment variables must be handled at the boundary
const GCS_BUCKET = import.meta.env.VITE_GCS_BUCKET || 'default-gcs-bucket-url';
const COURSES_DATA_URL = `${GCS_BUCKET}/courses.json`;
const COURSES_HASH_URL = `${GCS_BUCKET}/courses.hash.json`;
// ----------------------------------------


/**
 * Infrastructure Adapter to load and parse Course data, using a 
 * Stale-While-Revalidate (SWR) caching strategy via IndexedDB.
 * * @returns A promise resolving to an array of valid Course models.
 * @throws {Error} on critical failure (e.g., cache is empty AND network fails).
 */
export async function loadCoursesWithCache(): Promise<Course[]> {
  console.log(`Attempting to load course data using SWR cache...`);

  try {
    // Fetch/Cache Policy
    //   The cache handles fetching, hash-checking, and falling back to stale data.
    //   The result is the raw JSON array (RawCourse[]).
    const rawData: RawCourse[] = await cache.fetch(
      COURSES_DATA_URL,
      COURSES_HASH_URL
    );

    // If fetch failed and cache was empty, rawData might be null/undefined,
    // or the cache might throw an error. Assuming it throws on critical failure.
    if (!rawData) {
      throw new Error("Received no data from cache or network.");
    }

    // Root Data Structure Check
    if (!Array.isArray(rawData)) {
      throw new Error('Invalid data structure: Expected a root array of courses.');
    }

    // Delegation to Domain Layer: Transformation and Validation
    return rawData
      .map(raw => {
        try {
          // Call the pure domain parsing function
          return parseRawCourse(raw);
        } catch (error) {
          // Gracefully skip records that fail domain validation
          const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
          console.warn(`[Domain Validation Failure] Skipping course record: ${errorMessage}`);
          return null;
        }
      })
      .filter((course): course is Course => course !== null); // Remove skipped records

  } catch (error) {
    // Catch-all for IO failure
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Critical failure in loadCoursesWithCache:', errorMessage);
    // Propagate a clear application error
    throw new Error('Course data loading failed due to infrastructure issues.');
  }
}