import { flushSync, mount, unmount } from 'svelte';
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { currentHelsinkiWeek } from '../../../src/application/calendar/currentHelsinkiWeek';
import { shiftHelsinkiWeek } from '../../../src/application/calendar/weekNavigation';
import WeekNavigation from '../../../src/components/calendar/WeekNavigation.svelte';

const mounted: Array<ReturnType<typeof mount>> = [];
const targets: HTMLElement[] = [];
function render(weekStart: string) {
  const target = document.createElement('div');
  document.body.append(target);
  targets.push(target);
  const handlers = { onPrevious: vi.fn(), onNext: vi.fn(), onToday: vi.fn() };
  mounted.push(mount(WeekNavigation, { target, props: { weekStart, ...handlers } }));
  flushSync();
  return { target, handlers };
}
function click(target: HTMLElement, label: string) {
  const button = target.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  expect(button).not.toBeNull();
  button!.click();
  flushSync();
}

afterEach(async () => {
  for (const component of mounted.splice(0)) await unmount(component);
  for (const target of targets.splice(0)) target.remove();
});

describe('WeekNavigation', () => {
  it('shows the seven-day range across the year boundary', () => {
    const { target } = render('2025-12-29');

    expect(target.textContent).toContain('2025-12-29 – 2026-01-04');
    expect(target.textContent).not.toContain('Europe/Helsinki');
  });

  it('provides accessible previous and next controls', () => {
    const { target, handlers } = render('2026-11-02');
    click(target, 'Previous week');
    click(target, 'Next week');
    expect(handlers.onPrevious).toHaveBeenCalledOnce();
    expect(handlers.onNext).toHaveBeenCalledOnce();
  });

  it('uses shared secondary buttons without changing navigation behavior', () => {
    const { target } = render('2026-11-02');
    const buttons = [...target.querySelectorAll<HTMLButtonElement>('.controls button')];
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      expect(button.classList.contains('ui-button')).toBe(true);
      expect(button.classList.contains('ui-button--secondary')).toBe(true);
      expect(button.type).toBe('button');
    }
  });

  it('offers Today when displaying another week', () => {
    const otherWeek = shiftHelsinkiWeek(currentHelsinkiWeek(), -1);
    const { target, handlers } = render(otherWeek);
    const today = [...target.querySelectorAll('button')].find(button => button.textContent === 'Today');
    expect(today?.disabled).toBe(false);
    today?.click();
    expect(handlers.onToday).toHaveBeenCalledOnce();
  });

  it('disables Today when already on the current Helsinki week', () => {
    const { target } = render(currentHelsinkiWeek());
    const today = [...target.querySelectorAll('button')].find(button => button.textContent === 'Today');
    expect(today?.disabled).toBe(true);
  });
});
