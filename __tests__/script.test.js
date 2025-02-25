import { expect, test } from 'vitest';

const allowedCourses = [
  'MS-A0111', 'MS-A0011', 'MS-A0211', 'MS-A0503', 
  'ELEC-A7200', 'CS-A1110', 'ELEC-A7100', 'ELEC-C9801', 
  'CS-A1140', 'ELEC-C7222', 'TU-A1300', 'SCI-A1010', 
  'ELEC-C5231', 'LC-1117', 'ELEC-C7420', 'ELEC-C9620', 
  'ELEC-C9822', 'ELEC-C5310', 'ELEC-C8201', 'ELEC-E7840', 
  'ELEC-E8001', 'ELEC-C9410', 'ELEC-C0302'
];

function isValidCourse(courseCode) {
  return allowedCourses.includes(courseCode);
}

test('returns true for valid course codes', () => {
  expect(isValidCourse('MS-A0111')).toBe(true);
  expect(isValidCourse('ELEC-A7200')).toBe(true);
  expect(isValidCourse('ELEC-C9822')).toBe(true);
});

test('returns false for invalid course codes', () => {
  expect(isValidCourse('MS-A9999')).toBe(false);
  expect(isValidCourse('ELEC-XXXXX')).toBe(false);
  expect(isValidCourse('CS-A9999')).toBe(false);
});
