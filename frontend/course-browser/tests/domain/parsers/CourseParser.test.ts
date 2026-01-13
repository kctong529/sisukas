import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseRawCourse, type RawCourse } from '../../../src/domain/parsers/CourseParser';

// Mock the Course and Prerequisites classes
vi.mock('../../../src/domain/models/Course', () => {
  const MockCourse = vi.fn();
  return { Course: MockCourse };
});

vi.mock('../../../src/domain/valueObjects/Prerequisites', () => {
  const MockPrerequisites = vi.fn();
  return { Prerequisites: MockPrerequisites };
});

import { Course } from '../../../src/domain/models/Course';
import { Prerequisites } from '../../../src/domain/valueObjects/Prerequisites';

const mockValidRawCourse: RawCourse = {
  id: 'aalto-CUR-206094-3121874',
  courseUnitId: 'aalto-CU-1150973072-20240801',
  code: 'CS-A1120',
  name: { en: 'Programming 2, Lecture', fi: 'Ohjelmointi 2, Luento-opetus', sv: 'Programmering 2, Föreläsning' },
  startDate: '2026-02-23',
  endDate: '2026-05-29',
  enrolmentStartDate: '2026-01-26',
  enrolmentEndDate: '2026-03-02',
  credits: { min: 5, max: 5 },
  summary: {
    prerequisites: {
      en: "Recommended prerequisites: CS-A1110 Programming 1",
      fi: "Suositellut esitiedot: CS-A1110 Ohjelmointi 1",
      sv: "Rekommenderade förkunskaper: CS-A1110 Programmering 1"
    },
    level: {
      fi: "basic-studies",
      sv: "basic-studies",
      en: "basic-studies"
    }
  },
  organizationName: {
    fi: "Tietotekniikan laitos",
    sv: "Institutionen för datateknik",
    en: "Department of Computer Science"
  },
  teachers: ['Johan Lukas Ahrenberg', 'Sanna Helena Suoranta'],
  languageOfInstructionCodes: ['en'],
  type: 'teaching-participation-lectures',
  tags: ['programming', 'core'],
  lastUpdated: '2024-10-01T10:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseRawCourse', () => {

  it('should correctly transform a fully populated, realistic raw object into a Course instance (happy path)', () => {
    const rawData: RawCourse = { ...mockValidRawCourse };
    parseRawCourse(rawData);

    expect(Course).toHaveBeenCalledTimes(1);
    const courseParams = vi.mocked(Course).mock.calls[0][0];

    // Check basic string/number fields
    expect(courseParams.id).toBe(rawData.id);
    expect(courseParams.code).toBe('CS-A1120');
    expect(courseParams.organization).toBe('Department of Computer Science');
    expect(courseParams.level).toBe('basic-studies');
    expect(courseParams.languages).toEqual(['en']);

    // Check Date objects
    expect(courseParams.courseDate.start).toBeInstanceOf(Date);
    expect(courseParams.courseDate.end).toBeInstanceOf(Date);

    // Check DateRange accuracy (using timestamps for precise equality)
    expect(courseParams.courseDate.start.getTime()).toBe(new Date(rawData.startDate).getTime());
    expect(courseParams.enrollmentDate.end.getTime()).toBe(new Date(rawData.enrolmentEndDate).getTime());

    // Check Value Object wrapping (Prerequisites)
    expect(Prerequisites).toHaveBeenCalledTimes(1);
    expect(vi.mocked(Prerequisites).mock.calls[0][0]).toEqual(rawData.summary.prerequisites);
  });

  it('should handle string prerequisites correctly (mapping to en: string)', () => {
    const rawData: RawCourse = {
      ...mockValidRawCourse,
      id: 'STRING_PREREQ',
      summary: {
        ...mockValidRawCourse.summary,
        prerequisites: 'Basic math skills required (string)',
      },
    };

    parseRawCourse(rawData);
    expect(Prerequisites).toHaveBeenCalledTimes(1);

    // Check that the string prerequisite was wrapped in LocalizedString format before being passed to Prerequisites constructor
    expect(vi.mocked(Prerequisites).mock.calls[0][0]).toEqual({ en: rawData.summary.prerequisites });
  });

  it('should handle LocalizedString prerequisites correctly', () => {
    const localizedPrereq = { en: 'Finnish 1', fi: 'Suomi 1' };
    const rawData: RawCourse = {
      ...mockValidRawCourse,
      id: 'LOCALIZED_PREREQ',
      summary: {
        ...mockValidRawCourse.summary,
        prerequisites: localizedPrereq,
      },
    };

    parseRawCourse(rawData);

    expect(Prerequisites).toHaveBeenCalledTimes(1);
    expect(vi.mocked(Prerequisites).mock.calls[0][0]).toEqual(localizedPrereq);
  });

  it('should handle missing optional fields (description, tags, prerequisites)', () => {
    const rawData: RawCourse = {
      ...mockValidRawCourse,
      id: 'MISSING_FIELDS',
      summary: {
        ...mockValidRawCourse.summary,
        prerequisites: undefined,
      },
      tags: undefined,
    };

    parseRawCourse(rawData);

    const courseParams = vi.mocked(Course).mock.calls[0][0];

    expect(courseParams.tags).toBeUndefined();
    expect(courseParams.prerequisites).toBeUndefined();
    expect(Prerequisites).not.toHaveBeenCalled();
  });

  it('should throw an error for invalid primary dates (startDate or endDate)', () => {
    const rawInvalidStartDate: RawCourse = { ...mockValidRawCourse, id: 'INVALID_START', startDate: 'not-a-date' };
    const rawInvalidEndDate: RawCourse = { ...mockValidRawCourse, id: 'INVALID_END', endDate: 'bad-format' };

    expect(() => parseRawCourse(rawInvalidStartDate)).toThrowError(
      `Invalid primary date found for course ID ${rawInvalidStartDate.id}`
    );
    expect(() => parseRawCourse(rawInvalidEndDate)).toThrowError(
      `Invalid primary date found for course ID ${rawInvalidEndDate.id}`
    );
  });

  it('should throw an error for invalid enrolment dates', () => {
    // 1. Arrange
    const rawInvalidEnrolStart: RawCourse = { ...mockValidRawCourse, id: 'INVALID_ENROL_START', enrolmentStartDate: 'not-a-date-at-all' };
    const rawInvalidEnrolEnd: RawCourse = { ...mockValidRawCourse, id: 'INVALID_ENROL_END', enrolmentEndDate: 'tomorrow' };

    // 2. Act & Assert
    expect(() => parseRawCourse(rawInvalidEnrolStart)).toThrowError(
      `Invalid enrolment date found for course ID ${rawInvalidEnrolStart.id}`
    );
    expect(() => parseRawCourse(rawInvalidEnrolEnd)).toThrowError(
      `Invalid enrolment date found for course ID ${rawInvalidEnrolEnd.id}`
    );
  });
});