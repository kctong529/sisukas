// src/domain/valueObjects/Prerequisites.ts
import type { LocalizedString } from './LocalizedString';
import type { CourseCode } from './CourseCode';

export class Prerequisites {
  readonly raw: LocalizedString;
  readonly codePatterns: string[]; // patterns like "MS-A00XX"
  readonly hasTextOnly: boolean; // indicates if there are only textual requirements

  constructor(raw: LocalizedString, codePatterns?: string[]) {
    this.raw = raw;
    this.codePatterns = codePatterns ?? Prerequisites.extractCourseCodePatterns(raw.en);
    this.hasTextOnly = this.codePatterns.length === 0;
  }

  /** Validate if a student’s completed courses satisfy all patterns */
  validate(completedCourses: CourseCode[]): boolean {
    return this.codePatterns.every(pattern =>
      completedCourses.some(courseCode => Prerequisites.matchesPattern(courseCode.value, pattern))
    );
  }
  
  /** Extract course patterns from text using regex */
  private static extractCourseCodePatterns(text: string): string[] {
    const matches = text.match(/[A-Z]{2,}-[A0-9X]{4,}/g);
    return matches ?? [];
  }

  /** Check if a course code matches a pattern with wildcards ('X' = any char) */
  private static matchesPattern(courseCode: string, pattern: string): boolean {
    // Convert "A00XX" → regex "A00.."
    const regexStr = '^' + pattern.replace(/X/g, '.') + '$';
    const regex = new RegExp(regexStr);
    return regex.test(courseCode);
  }
}