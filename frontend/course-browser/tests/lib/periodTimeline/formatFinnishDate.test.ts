import { describe, expect, it } from 'vitest';

import { formatFinnishDate } from '../../../src/lib/periodTimeline/formatFinnishDate';

describe('formatFinnishDate', () => {
  it('pads day and month to two digits', () => {
    expect(formatFinnishDate(new Date(2027, 0, 1))).toBe('01.01.2027');
  });

  it('formats academic period boundaries using local calendar dates', () => {
    expect(formatFinnishDate(new Date(2026, 7, 31))).toBe('31.08.2026');
    expect(formatFinnishDate(new Date(2026, 9, 18))).toBe('18.10.2026');
  });
});
