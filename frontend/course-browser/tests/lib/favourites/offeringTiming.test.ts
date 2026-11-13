import { describe, expect, it } from 'vitest';

import { offeringTiming } from '../../../src/lib/favourites/offeringTiming';

const at = (date: string) => new Date(`${date}T12:00:00+02:00`);

describe('offeringTiming', () => {
  const today = at('2026-11-13');

  it('classifies offerings that ended before today as past', () => {
    expect(offeringTiming(at('2026-09-01'), at('2026-11-12'), today)).toBe('past');
  });

  it('classifies offerings active today as current, including both endpoints', () => {
    expect(offeringTiming(at('2026-11-13'), at('2026-12-01'), today)).toBe('current');
    expect(offeringTiming(at('2026-10-01'), at('2026-11-13'), today)).toBe('current');
  });

  it('classifies offerings starting after today as future', () => {
    expect(offeringTiming(at('2026-11-14'), at('2027-01-01'), today)).toBe('future');
  });
});
