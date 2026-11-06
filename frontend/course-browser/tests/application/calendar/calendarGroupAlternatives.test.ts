import { describe, expect, it } from 'vitest';
import { calendarGroupAlternatives } from '../../../src/application/calendar/calendarGroupAlternatives';
import type { StudyGroup } from '../../../src/domain/models/StudyGroup';

const group = (groupId: string, name: string, type: string, count = 0): StudyGroup => ({
  groupId, name, type, studyEvents: Array.from({ length: count }, () => ({} as StudyGroup['studyEvents'][number])),
});

describe('calendarGroupAlternatives', () => {
  it('does not discover alternatives from missing or empty full data', () => {
    expect(calendarGroupAlternatives(null, 'H01')).toEqual([]);
    expect(calendarGroupAlternatives([], 'H01')).toEqual([]);
  });

  it('keeps only same-type groups, preserving names and source event counts', () => {
    const source = [
      group('H01', 'H01', 'Exercise', 3),
      group('H02', 'H02', 'exercise', 5),
      group('L01', 'L01', 'Lecture', 4),
      group('H03', 'DATA SCIENCE', 'Exercise', 0),
    ];
    expect(calendarGroupAlternatives(source, 'H01')).toEqual([
      { groupId: 'H02', label: 'exercise H02', eventCount: 5 },
      { groupId: 'H03', label: 'Exercise · DATA SCIENCE', eventCount: 0 },
    ]);
    expect(source[0].name).toBe('H01');
  });

  it('does not infer types or invent an alternative from unknown group IDs', () => {
    const source = [group('H01', 'H01', ''), group('H02', 'H02', '')];
    expect(calendarGroupAlternatives(source, 'H01')).toEqual([]);
    expect(calendarGroupAlternatives(source, 'absent')).toEqual([]);
  });

  it('ignores duplicate group identifiers and respects exact teaching type', () => {
    const source = [
      group('a', 'A', 'IT exercise'),
      group('b', 'B', 'IT exercise'),
      group('b', 'duplicate', 'IT exercise'),
      group('c', 'C', 'Exercise'),
    ];
    expect(calendarGroupAlternatives(source, 'a')).toEqual([
      { groupId: 'b', label: 'IT exercise B', eventCount: 0 },
    ]);
  });
});
