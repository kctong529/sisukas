import { describe, expect, it } from 'vitest';

import { calendarOfferingColorIndices, weekAwareOfferingColorIndices } from '../../../src/application/calendar/calendarOfferingColors';
import { planOfferingColorIndices } from '../../../src/application/calendar/planOfferingColors';
import { fixed } from '../../domain/services/calendar/layout/fixtures';

describe('shared plan offering colors', () => {
  it('matches the calendar optimizer whenever a projection exists', () => {
    const ids = ['lecture-a', 'lecture-b', 'lecture-c'];
    const entries = ids.map((id, index) => {
      const start = `2026-11-02T${String(10 + index).padStart(2, '0')}:00:00+02:00`;
      const end = `2026-11-02T${String(11 + index).padStart(2, '0')}:00:00+02:00`;
      const entry = fixed(id, start, end);
      return { ...entry, source: { ...entry.source, courseOfferingId: id } };
    });
    expect(planOfferingColorIndices(ids, entries)).toEqual(weekAwareOfferingColorIndices(ids, entries));
  });

  it('uses Calendar sequential assignment only while projection is unavailable', () => {
    const ids = ['first', 'second', 'third'];
    expect(planOfferingColorIndices(ids, null)).toEqual(calendarOfferingColorIndices(ids));
    expect(planOfferingColorIndices(ids, undefined)).toEqual(calendarOfferingColorIndices(ids));
  });
});
