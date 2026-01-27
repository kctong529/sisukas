// src/infrastructure/loaders/RemoteCourseLoader.ts

import type { Course } from '../../domain/models/Course';
import { type RawCourse, parseRawCourse } from '../../domain/parsers/CourseParser';
import { LargeFileCache } from '../services/LargeFileCache';

const cache = new LargeFileCache();

interface CourseDatasetConfig {
  dataUrl: string;
  hashUrl: string;
  label: string;
}


async function loadCourseDatasetWithCache(
  config: CourseDatasetConfig
): Promise<Course[]> {
  const { dataUrl, hashUrl, label } = config;
  console.log(`Attempting to load ${label} data using SWR cache...`);

  try {
    const rawData = await cache.fetch(dataUrl, hashUrl) as RawCourse[];

    if (!rawData) {
      throw new Error(`Received no ${label} data from cache or network.`);
    }

    if (!Array.isArray(rawData)) {
      throw new Error(`Invalid data structure: Expected an array of ${label} records.`);
    }

    return rawData
      .map(raw => {
        try {
          return parseRawCourse(raw);
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown validation error';
          console.warn(
            `[Domain Validation Failure] Skipping ${label} record: ${msg}`
          );
          return null;
        }
      })
      .filter((course): course is Course => course !== null);

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Critical failure loading ${label}:`, msg);
    throw new Error(`${label} data loading failed due to infrastructure issues.`);
  }
}

// --- Configuration ---
const GCS_BUCKET = import.meta.env.VITE_GCS_BUCKET || 'default-gcs-bucket-url';
const COURSES_DATA_URL = `${GCS_BUCKET}/courses.json`;
const COURSES_HASH_URL = `${GCS_BUCKET}/courses.hash.json`;
const HISTORICAL_DATA_URL = `${GCS_BUCKET}/historical.json`;
const HISTORICAL_HASH_URL = `${GCS_BUCKET}/historical.hash.json`;
// ---------------------

export function loadCoursesWithCache(): Promise<Course[]> {
  return loadCourseDatasetWithCache({
    dataUrl: COURSES_DATA_URL,
    hashUrl: COURSES_HASH_URL,
    label: 'course'
  });
}

export function loadHistoricalCoursesWithCache(): Promise<Course[]> {
  return loadCourseDatasetWithCache({
    dataUrl: HISTORICAL_DATA_URL,
    hashUrl: HISTORICAL_HASH_URL,
    label: 'historical course'
  });
}
