
import { describe, expect, it } from 'vitest';

import {
  parseRawCourse,
  type RawCourse,
} from '../../../src/domain/parsers/CourseParser';

const mockValidRawCourse: RawCourse = {
  id: 'aalto-CUR-test-123',
  courseUnitId: 'aalto-CU-test-123',
  code: 'CS-E1234',
  name: {
    fi: 'Esimerkkikurssi',
    sv: 'Exempelkurs',
    en: 'Example Course',
  },

  startDate: '2026-03-01',
  endDate: '2026-05-31',
  enrolmentStartDate: '2026-01-26',
  enrolmentEndDate: '2026-03-02',

  credits: {
    min: 5,
    max: 5,
  },

  summary: {
    level: {
      fi: 'advanced-studies',
      sv: 'advanced-studies',
      en: 'advanced-studies',
    },
    prerequisites: {
      fi: '',
      sv: '',
      en: 'Basic programming knowledge',
    },
  },

  organizationName: {
    fi: 'Tietotekniikan laitos',
    sv: 'Institutionen för datateknik',
    en: 'Department of Computer Science',
  },

  teachers: ['Example Teacher'],
  languageOfInstructionCodes: ['en'],
  type: 'teaching-participation-contact',
};

function withChanges(
  changes: Partial<RawCourse>,
): RawCourse {
  return {
    ...mockValidRawCourse,
    ...changes,
  };
}

describe('CourseParser', () => {
  describe('valid course records', () => {
    it('parses a valid course', () => {
      const course = parseRawCourse(mockValidRawCourse);

      expect(course.id).toBe(mockValidRawCourse.id);
      expect(course.code.value).toBe(mockValidRawCourse.code);
      expect(course.unitId).toBe(mockValidRawCourse.courseUnitId);
    });

    it('parses primary course dates', () => {
      const course = parseRawCourse(mockValidRawCourse);

      expect(course.courseDate.start.toISOString()).toBe(
        '2026-03-01T00:00:00.000Z',
      );
      expect(course.courseDate.end.toISOString()).toBe(
        '2026-05-31T00:00:00.000Z',
      );
    });

    it('parses enrolment dates', () => {
      const course = parseRawCourse(mockValidRawCourse);

      expect(course.enrollmentDate.start.toISOString()).toBe(
        '2026-01-26T00:00:00.000Z',
      );
      expect(course.enrollmentDate.end.toISOString()).toBe(
        '2026-03-02T00:00:00.000Z',
      );
    });

    it('preserves course metadata', () => {
      const course = parseRawCourse(mockValidRawCourse);

      expect(course.name).toEqual(mockValidRawCourse.name);
      expect(course.credits).toEqual(mockValidRawCourse.credits);
      expect(course.teachers).toEqual(mockValidRawCourse.teachers);
    });

    it('allows a course whose start and end dates are equal', () => {
      const course = parseRawCourse(withChanges({
        startDate: '2026-03-01',
        endDate: '2026-03-01',
      }));

      expect(course.courseDate.start.getTime()).toBe(
        course.courseDate.end.getTime(),
      );
    });

    it('accepts leap-day dates', () => {
      const course = parseRawCourse(withChanges({
        startDate: '2028-02-29',
        endDate: '2028-03-01',
      }));

      expect(course.courseDate.start.toISOString()).toBe(
        '2028-02-29T00:00:00.000Z',
      );
    });
  });

  describe('primary date validation', () => {
    it.each([
      ['invalid start date', { startDate: 'not-a-date' }],
      ['invalid end date', { endDate: 'tomorrow' }],
      ['impossible calendar date', { startDate: '2026-02-30' }],
      ['invalid leap day', { startDate: '2027-02-29' }],
      ['timestamp with periods', {
        startDate: '2026-03-01T09.00.00',
      }],
      ['ISO datetime', {
        startDate: '2026-03-01T09:00:00',
      }],
      ['empty date', { startDate: '' }],
    ])('rejects %s', (_description, changes) => {
      expect(() =>
        parseRawCourse(withChanges(changes))
      ).toThrow(/Invalid primary date/);
    });

    it('rejects reversed course date ranges', () => {
      expect(() =>
        parseRawCourse(withChanges({
          startDate: '2026-06-01',
          endDate: '2026-05-31',
        }))
      ).toThrow(/Invalid primary date range/);
    });
  });

  describe('enrolment date validation', () => {
    it.each([
      ['invalid start date', {
        enrolmentStartDate: 'not-a-date-at-all',
      }],
      ['invalid end date', {
        enrolmentEndDate: 'tomorrow',
      }],
      ['upstream start timestamp', {
        enrolmentStartDate: '2026-01-26T09.00.00',
      }],
      ['upstream end timestamp', {
        enrolmentEndDate: '2026-03-02T11.59.00',
      }],
      ['ISO datetime', {
        enrolmentStartDate: '2026-01-26T09:00:00',
      }],
      ['impossible calendar date', {
        enrolmentStartDate: '2026-02-30',
      }],
      ['empty string', {
        enrolmentStartDate: '',
      }],
    ])('rejects %s', (_description, changes) => {
      expect(() =>
        parseRawCourse(withChanges(changes))
      ).toThrow(/Invalid enrolment date/);
    });

    it('accepts the normalized form of an upstream enrolment timestamp', () => {
      const course = parseRawCourse(withChanges({
        enrolmentStartDate: '2026-12-25',
        enrolmentEndDate: '2027-02-16',
      }));

      expect(course.enrollmentDate.start.toISOString()).toBe(
        '2026-12-25T00:00:00.000Z',
      );

      expect(course.enrollmentDate.end.toISOString()).toBe(
        '2027-02-16T00:00:00.000Z',
      );
    });

    it('rejects reversed enrolment date ranges', () => {
      expect(() =>
        parseRawCourse(withChanges({
          enrolmentStartDate: '2026-03-03',
          enrolmentEndDate: '2026-03-02',
        }))
      ).toThrow(/Invalid enrolment date range/);
    });

    it('falls back to course dates when both enrolment dates are null', () => {
      const course = parseRawCourse(withChanges({
        enrolmentStartDate: null,
        enrolmentEndDate: null,
      }));

      expect(course.enrollmentDate.start.getTime()).toBe(
        course.courseDate.start.getTime(),
      );
      expect(course.enrollmentDate.end.getTime()).toBe(
        course.courseDate.end.getTime(),
      );
    });

    it('falls back only for a missing start date', () => {
      const course = parseRawCourse(withChanges({
        enrolmentStartDate: null,
        enrolmentEndDate: '2026-03-02',
      }));

      expect(course.enrollmentDate.start.getTime()).toBe(
        course.courseDate.start.getTime(),
      );
      expect(course.enrollmentDate.end.toISOString()).toBe(
        '2026-03-02T00:00:00.000Z',
      );
    });

    it('falls back only for a missing end date', () => {
      const course = parseRawCourse(withChanges({
        enrolmentStartDate: '2026-01-26',
        enrolmentEndDate: null,
      }));

      expect(course.enrollmentDate.start.toISOString()).toBe(
        '2026-01-26T00:00:00.000Z',
      );
      expect(course.enrollmentDate.end.getTime()).toBe(
        course.courseDate.end.getTime(),
      );
    });

    it('does not interpret null as the Unix epoch', () => {
      const course = parseRawCourse(withChanges({
        enrolmentStartDate: null,
        enrolmentEndDate: null,
      }));

      expect(course.enrollmentDate.start.getUTCFullYear()).toBe(2026);
      expect(course.enrollmentDate.end.getUTCFullYear()).toBe(2026);
    });
  });

  describe('course formats', () => {
    it.each([
      ['independent-work-project', 'other'],
      ['teaching-participation-small-group', 'lecture'],
      ['teaching-participation-distance', 'lecture'],
      ['teaching-participation-seminar', 'lecture'],
      ['exam-midterm', 'exam'],
    ] as const)(
      'normalizes %s to %s',
      (type, expectedFormat) => {
        const course = parseRawCourse(withChanges({ type }));

        expect(course.format).toBe(expectedFormat);
      },
    );
  });

  describe('language handling', () => {
    it('preserves supported language codes', () => {
      const course = parseRawCourse(withChanges({
        languageOfInstructionCodes: ['en', 'fi', 'sv'],
      }));

      expect(course.languages).toEqual(['en', 'fi', 'sv']);
    });

    it('filters unsupported language codes', () => {
      const course = parseRawCourse(withChanges({
        languageOfInstructionCodes: [
          'en', 'de', 'fi', 'zh', '99', '',
        ],
      }));

      expect(course.languages).toEqual(['en', 'fi']);
    });

    it('allows no supported language codes', () => {
      const course = parseRawCourse(withChanges({
        languageOfInstructionCodes: ['de', 'fr'],
      }));

      expect(course.languages).toEqual([]);
    });
  });

  describe('optional metadata', () => {
    it('accepts courses without prerequisites', () => {
      const course = parseRawCourse(withChanges({
        summary: {
          level: mockValidRawCourse.summary.level,
        },
      }));

      expect(course.prerequisites).toBeUndefined();
    });

    it('accepts string prerequisites', () => {
      expect(() =>
        parseRawCourse(withChanges({
          summary: {
            level: mockValidRawCourse.summary.level,
            prerequisites: 'Basic programming knowledge',
          },
        }))
      ).not.toThrow();
    });

    it('accepts localized prerequisites', () => {
      expect(() =>
        parseRawCourse(withChanges({
          summary: {
            level: mockValidRawCourse.summary.level,
            prerequisites: {
              fi: 'Ohjelmoinnin perusteet',
              sv: 'Grundläggande programmering',
              en: 'Basic programming',
            },
          },
        }))
      ).not.toThrow();
    });

    it('preserves optional tags', () => {
      const course = parseRawCourse(withChanges({
        tags: ['robotics', 'programming'],
      }));

      expect(course.tags).toEqual(['robotics', 'programming']);
    });
  });
});
