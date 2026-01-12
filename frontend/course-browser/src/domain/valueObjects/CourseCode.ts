// src/domain/valueObjects/CourseCode.ts

/**
 * CourseCode Value Object
 * Ensures that the course code adheres to the required format:
 * - Contains exactly one dash ('-')
 * - Only alphabetical (A-Z, a-z) and numerical (0-9) characters besides the dash
 */
export class CourseCode {
  readonly value: string;

  constructor(rawCode: string) {
    const trimmedCode = rawCode.trim();

    const dashCount = (trimmedCode.match(/-/g) || []).length;
    const dotCount = (trimmedCode.match(/\./g) || []).length;

    // Ensure only alphanumeric, dash, or dot are present
    const forbiddenCharMatch = trimmedCode.match(/[^a-zA-Z0-9-.]/);
    if (forbiddenCharMatch) {
      throw new Error(
        `Invalid character in Course Code: "${trimmedCode}". Character "${forbiddenCharMatch[0]}" is forbidden.`,
      );
    }

    // Check if the code is empty or only consists of symbols after trimming
    if (trimmedCode.length === 0 || trimmedCode.length === dashCount + dotCount) {
        throw new Error(`Invalid Course Code: "${trimmedCode}". Code must contain alphanumeric characters.`);
    }

    // Positional Validation: Check start/end
    if (trimmedCode.startsWith('-') || trimmedCode.startsWith('.') || trimmedCode.endsWith('-') || trimmedCode.endsWith('.')) {
      throw new Error(
        `Invalid Course Code position: "${trimmedCode}". Dash or dot cannot be at the start or end.`,
      );
    }

    // Check for mutual exclusion
    if (dashCount > 0 && dotCount > 0) {
      throw new Error(
        `Invalid Course Code format: "${trimmedCode}". Cannot contain both dashes and dots (must be one OR the other).`,
      );
    }

    // Check max limits
    if (dashCount > 1) {
      throw new Error(`Invalid Course Code format: "${trimmedCode}". Must contain at most one dash.`);
    }

    if (dotCount > 2) {
      throw new Error(`Invalid Course Code format: "${trimmedCode}". Must contain at most two dots.`);
    }

    // Adjacent Dot Validation
    if (dotCount > 0 && trimmedCode.includes('..')) {
      throw new Error(`Invalid Course Code format: "${trimmedCode}". Dots cannot be adjacent ('..').`);
    }

    // Set value and normalize to uppercase
    this.value = trimmedCode.toUpperCase();
  }

  toString(): string {
    return this.value;
  }

  equals(other: CourseCode): boolean {
    return this.value === other.value;
  }
}