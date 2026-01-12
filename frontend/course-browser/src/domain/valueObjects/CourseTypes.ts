// src/domain/valueObjects/CourseTypes.ts
export type Language = 'en' | 'fi' | 'sv';
export type StudyLevel = 'basic-studies' | 'advanced-studies' | 'other-studies' | 'postgraduate-studies' | 'intermediate-studies';

export type RawCourseFormat =
  | 'teaching-participation-contact'
  | 'thesis-bachelor'
  | 'teaching-participation-lectures'
  | 'independent-work-essay'
  | 'teaching-participation-project'
  | 'teaching-participation-online'
  | 'exam-online'
  | 'exam-electronic'
  | 'exam-exam'
  | 'teaching-participation-blended';

export type CourseFormat = 'lecture' | 'thesis' | 'exam' | 'other';

export function normalizeCourseFormat(format: RawCourseFormat): CourseFormat {
  if (format.startsWith('teaching-participation')) return 'lecture';
  if (format.startsWith('exam')) return 'exam';
  if (format === 'thesis-bachelor' || format === 'independent-work-essay') return 'thesis';
  return 'other';
}