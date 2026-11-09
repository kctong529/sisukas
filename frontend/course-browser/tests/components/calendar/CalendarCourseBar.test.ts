import { flushSync, mount, unmount } from 'svelte';
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import CalendarCourseBar from '../../../src/components/calendar/CalendarCourseBar.svelte';

import type { CalendarWeekCourse } from '../../../src/application/calendar/calendarCoursesForWeek';

const course = (offeringId: string): CalendarWeekCourse => ({
  offeringId, code: offeringId, title: `${offeringId} title`, course: {} as CalendarWeekCourse['course'],
});
const instances: Array<ReturnType<typeof mount>> = [];
const targets: HTMLElement[] = [];
function render(courses: CalendarWeekCourse[], onSelect = vi.fn(), onPreview = vi.fn()) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  targets.push(target);
  instances.push(mount(CalendarCourseBar, {
    target, props: { courses, colorByOffering: {}, selectedOfferingId: null, onSelect, onPreview },
  }));
  flushSync();
  return { target, onSelect, onPreview };
}
afterEach(async () => {
  for (const instance of instances.splice(0)) await unmount(instance);
  for (const target of targets.splice(0)) target.remove();
});

describe('calendar course bar', () => {
  it('exposes accessible offering buttons and selects course context', () => {
    const { target, onSelect } = render([course('A'), course('B')]);
    expect(target.querySelectorAll('nav[aria-label="Courses active this week"] button')).toHaveLength(2);
    target.querySelector<HTMLButtonElement>('button')?.click();
    expect(onSelect).toHaveBeenCalledWith('A');
  });
  it('highlights on keyboard focus and clears the preview on blur', () => {
    const { target, onPreview } = render([course('A')]);
    const button = target.querySelector<HTMLButtonElement>('button')!;
    button.focus();
    expect(onPreview).toHaveBeenCalledWith('A');
    button.blur();
    expect(onPreview).toHaveBeenLastCalledWith(null);
  });
  it('keeps the bar visible when no events or offerings overlap', () => {
    const { target } = render([]);
    expect(target.textContent).toContain('No courses overlap this week');
  });
});
