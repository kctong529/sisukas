 // @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';

import CoursePeriodBadge from '../../src/components/CoursePeriodBadge.svelte';
import { academicPeriodStore } from '../../src/lib/stores/academicPeriodStore';
import type { AcademicPeriod } from '../../src/domain/models/AcademicPeriod';
import type { DateRange } from '../../src/domain/valueObjects/DateRange';

const range = (start: string, end: string): DateRange => ({
  start: new Date(`${start}T12:00:00Z`),
  end: new Date(`${end}T12:00:00Z`),
});

const period = (
  academicYear: string,
  dateRange: DateRange
): AcademicPeriod => ({
  id: academicYear,
  name: academicYear,
  academicYear,
  dateRange,
});

const courseDate = range('2026-09-01', '2026-12-15');
const datesLabel = '01.09. – 15.12.';

const mounted: Array<ReturnType<typeof mount>> = [];

function renderBadge(dateRange = courseDate): HTMLElement {
  const target = document.createElement('div');
  document.body.appendChild(target);

  mounted.push(
    mount(CoursePeriodBadge, {
      target,
      props: { courseDate: dateRange },
    })
  );

  flushSync();
  return target;
}

function click(button: HTMLButtonElement): void {
  button.click();
  flushSync();
}

describe('CoursePeriodBadge', () => {
  beforeEach(() => {
    academicPeriodStore.setPeriods([
      period('2026-27', range('2026-08-01', '2027-07-31')),
    ]);
  });

  afterEach(async () => {
    for (const component of mounted.splice(0)) {
      await unmount(component);
    }

    document.body.replaceChildren();
    academicPeriodStore.setPeriods([]);
  });

  it('shows course dates by default and toggles to the academic year and back', () => {
    const target = renderBadge();
    const badge = target.querySelector('button');

    expect(badge).not.toBeNull();
    expect(badge!.textContent?.trim()).toBe(datesLabel);
    expect(badge!.getAttribute('aria-pressed')).toBe('false');

    click(badge!);

    expect(badge!.textContent?.trim()).toBe('2026 – 27');
    expect(badge!.getAttribute('aria-pressed')).toBe('true');
    expect(badge!.getAttribute('aria-label')).toBe('Show course dates');

    click(badge!);

    expect(badge!.textContent?.trim()).toBe(datesLabel);
    expect(badge!.getAttribute('aria-pressed')).toBe('false');
  });

  it('chooses the earliest overlapping academic year regardless of store order', () => {
    academicPeriodStore.setPeriods([
      period('2027-28', range('2027-08-01', '2028-07-31')),
      period('2026-27', range('2026-08-01', '2027-07-31')),
      period('2025-26', range('2025-08-01', '2026-07-31')),
    ]);

    const target = renderBadge(range('2026-07-30', '2027-09-01'));
    const badge = target.querySelector('button')!;

    click(badge);

    expect(badge.textContent?.trim()).toBe('2025 – 26');
  });

  it('keeps the date range non-interactive when no period overlaps', () => {
    const target = renderBadge(range('2030-01-01', '2030-02-01'));

    expect(target.querySelector('button')).toBeNull();
    expect(
      target.querySelector('span.card-period')?.textContent?.trim()
    ).toBe('01.01. – 01.02.');
  });

  it('keeps toggle state independent between badges', () => {
    const first = renderBadge();
    const second = renderBadge();

    const firstButton = first.querySelector('button')!;
    const secondButton = second.querySelector('button')!;

    click(firstButton);

    expect(firstButton.textContent?.trim()).toBe('2026 – 27');
    expect(secondButton.textContent?.trim()).toBe(datesLabel);

    click(secondButton);

    expect(firstButton.textContent?.trim()).toBe('2026 – 27');
    expect(secondButton.textContent?.trim()).toBe('2026 – 27');

    click(firstButton);

    expect(firstButton.textContent?.trim()).toBe(datesLabel);
    expect(secondButton.textContent?.trim()).toBe('2026 – 27');
  });

  it('uses an accessible native button', () => {
    const button = renderBadge().querySelector('button')!;

    expect(button.type).toBe('button');
    expect(button.tabIndex).toBe(0);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe('Show academic year');
  });
});
