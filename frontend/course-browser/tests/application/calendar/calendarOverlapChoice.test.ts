import { describe, expect, it } from 'vitest';

import { chooseOverlappingOccurrence } from '@application/calendar/calendarOverlapChoice';
import { calendarGroupKey } from '@application/calendar/calendarVisibility';

import type { CalendarEntry } from '@domain/models/CalendarEntry';

const visibility = { hiddenGroups: [], occurrenceOverrides: {} };
const entry = (id: string, start: number, end: number, options: { offering?: string; group?: string; cancelled?: boolean; key?: string | null } = {}): CalendarEntry => ({
  kind: 'fixed', occurrenceKey: options.key === undefined ? id : options.key,
  interval: { startMs: start, endMs: end }, source: {
    courseOfferingId: options.offering ?? 'offering', studyGroupId: options.group ?? id, seriesId: id,
    event: { id, start: '', end: '', locationIds: [], locations: [], cancelled: options.cancelled ?? false, excluded: false },
  },
});
const card = (e: CalendarEntry, members: CalendarEntry[] = [e]) => ({ entry: e, members });

describe('one-click direct overlap resolution (#103)', () => {
  it('hides only directly overlapping events, never chain-only or adjacent events', () => {
    const a = card(entry('a', 0, 10));
    const b = card(entry('b', 5, 15));
    const c = card(entry('c', 12, 20));
    const touching = card(entry('touch', 10, 30));
    const result = chooseOverlappingOccurrence(a, [a, b, c, touching], visibility);
    expect(result).toMatchObject({ available: true, overlapCount: 1, keysToShow: [], keysToHide: ['b'] });
  });
  it('handles concurrent events and is not limited to one course offering', () => {
    const selected = card(entry('selected', 100, 200));
    const peers = ['b', 'c', 'd', 'e'].map(id => card(entry(id, 150, 170, { offering: id })));
    const result = chooseOverlappingOccurrence(selected, [selected, ...peers], visibility);
    expect(result.overlapCount).toBe(4);
    expect(result.keysToHide).toEqual(['b', 'c', 'd', 'e']);
  });
  it('preserves aggregated source identities on both sides', () => {
    const one = entry('one', 100, 200);
    const two = entry('two', 100, 200);
    const a = card(one, [one, two]);
    const x = entry('x', 110, 190), y = entry('y', 110, 190);
    expect(chooseOverlappingOccurrence(a, [a, card(x, [x, y])], visibility)).toMatchObject({
      available: true, overlapCount: 1, keysToHide: ['x', 'y'],
    });
  });
  it('restores hidden chosen source members without unhiding the whole group', () => {
    const chosen = entry('chosen', 100, 200, { group: 'exercise' });
    const peer = entry('peer', 150, 180);
    const result = chooseOverlappingOccurrence(card(chosen), [card(chosen), card(peer)], {
      hiddenGroups: [calendarGroupKey('offering', 'exercise')], occurrenceOverrides: {},
    });
    expect(result.keysToShow).toEqual(['chosen']);
    expect(result.keysToHide).toEqual(['peer']);
  });
  it('rejects ambiguous overlapping identities instead of silently resolving part of the slot', () => {
    const chosen = card(entry('chosen', 100, 200));
    const broken = card(entry('ambiguous', 120, 180, { key: null }));
    expect(chooseOverlappingOccurrence(chosen, [chosen, broken], visibility)).toMatchObject({
      available: false, keysToHide: [], overlapCount: 0,
    });
    expect(chooseOverlappingOccurrence(broken, [chosen, broken], visibility).available).toBe(false);
  });
  it('ignores cancelled, already hidden and flexible events', () => {
    const chosen = card(entry('chosen', 100, 200));
    const cancelled = card(entry('cancelled', 110, 190, { cancelled: true }));
    const hidden = card(entry('hidden', 110, 190));
    const flex = card({ ...entry('flex', 110, 190), kind: 'flexible-window', evidence: { kind: 'verified-source-classification', sourceField: 'type', sourceValue: 'window' } });
    const result = chooseOverlappingOccurrence(chosen, [chosen, cancelled, hidden, flex], {
      hiddenGroups: [calendarGroupKey('offering', 'hidden')], occurrenceOverrides: {},
    });
    expect(result).toMatchObject({ available: false, overlapCount: 0 });
  });
  it('uses absolute epoch intervals across midnight and daylight saving transitions', () => {
    const chosen = card(entry('chosen', Date.parse('2026-10-25T00:30:00Z'), Date.parse('2026-10-25T02:30:00Z')));
    const peer = card(entry('peer', Date.parse('2026-10-25T01:30:00Z'), Date.parse('2026-10-25T03:00:00Z')));
    expect(chooseOverlappingOccurrence(chosen, [chosen, peer], visibility).keysToHide).toEqual(['peer']);
  });
});
