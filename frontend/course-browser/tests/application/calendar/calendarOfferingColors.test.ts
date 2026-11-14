import { describe, expect, it } from 'vitest';

import { CALENDAR_OFFERING_COLOR_COUNT, calendarOfferingColorIndices, weekAwareOfferingColorIndices } from '../../../src/application/calendar/calendarOfferingColors';
import { fixed } from '../../domain/services/calendar/layout/fixtures';

describe('calendar offering colors', () => {
  it('assigns twelve distinct indices, then repeats the palette', () => {
    const ids = Array.from({ length: 14 }, (_, index) => `off-${index}`);
    const colors = calendarOfferingColorIndices(ids);
    expect(CALENDAR_OFFERING_COLOR_COUNT).toBe(12);
    expect(ids.slice(0, 12).map(id => colors[id])).toEqual(Array.from({ length: 12 }, (_, i) => i));
    expect([colors['off-12'], colors['off-13']]).toEqual([0, 1]);
  });

  it('deduplicates offerings without changing their assigned colors', () => {
    const colors = calendarOfferingColorIndices(['alpha', 'beta', 'alpha', 'gamma']);
    expect(colors.alpha).toBe(0);
    expect(colors.beta).toBe(1);
    expect(colors.gamma).toBe(2);
    expect(Object.keys(colors)).toHaveLength(3);
  });

  it('handles arbitrary offering IDs as data rather than object properties', () => {
    const colors = calendarOfferingColorIndices(['__proto__', 'constructor', 'toString']);
    expect(colors['__proto__']).toBe(0);
    expect(colors.constructor).toBe(1);
    expect(colors.toString).toBe(2);
  });
});


describe('week-aware offering colors', () => {
  const occurrence = (id: string, day: number, hour: number) => {
    const date = `2026-11-${String(day).padStart(2, '0')}`;
    const start = `${date}T${String(hour).padStart(2, '0')}:00:00+02:00`;
    const end = `${date}T${String(hour + 1).padStart(2, '0')}:00:00+02:00`;
    const entry = fixed(id, start, end);
    return { ...entry, source: { ...entry.source, courseOfferingId: id } };
  };

  it('distinguishes all offerings present in a week, even without time overlap', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const entries = ids.map((id, index) => occurrence(id, 2 + index, 8 + index));
    const colors = weekAwareOfferingColorIndices(ids, entries);
    expect(new Set(ids.map(id => colors[id])).size).toBe(ids.length);
  });

  it('keeps one assignment across weeks and ignores source-event order', () => {
    const ids = ['a', 'b', 'c'];
    const entries = [occurrence('a', 2, 9), occurrence('b', 3, 10), occurrence('c', 4, 11), occurrence('a', 9, 9)];
    const original = weekAwareOfferingColorIndices(ids, entries);
    expect(weekAwareOfferingColorIndices([...ids].reverse(), [...entries].reverse())).toEqual(original);
    expect(original.a).toBeGreaterThanOrEqual(0);
    expect(original.a).toBeLessThan(12);
  });

  it('reuses colors only when more than twelve offerings share a week', () => {
    const ids = Array.from({ length: 13 }, (_, i) => `off-${i}`);
    const colors = weekAwareOfferingColorIndices(ids, ids.map(id => occurrence(id, 2, 10)));
    expect(new Set(ids.map(id => colors[id])).size).toBe(12);
  });

  it('does not treat offerings active in different weeks as conflicting', () => {
    const ids = ['a', 'b'];
    const colors = weekAwareOfferingColorIndices(ids, [occurrence('a', 2, 10), occurrence('b', 9, 10)]);
    expect(Object.keys(colors)).toEqual(ids);
  });

  it('handles empty data and prototype-like IDs', () => {
    const colors = weekAwareOfferingColorIndices(['__proto__', 'constructor'], []);
    expect(Object.keys(colors)).toHaveLength(2);
    expect(typeof colors['__proto__']).toBe('number');
  });
});
