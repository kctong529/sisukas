// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { calendarGroupKey } from '@application/calendar/calendarVisibility';

import CalendarCourseContext from '../../../src/components/calendar/CalendarCourseContext.svelte';

import type { CalendarWeekCourse } from '@application/calendar/calendarCoursesForWeek';

const mounted: Array<ReturnType<typeof mount>> = [];
const targets: HTMLElement[] = [];

function render() {
  const target = document.createElement('div');
  document.body.append(target);
  targets.push(target);
  const onChooseGroup = vi.fn();
  const onShowAll = vi.fn();
  const onToggleGroup = vi.fn();
  const course: CalendarWeekCourse = {
    offeringId: 'offer', code: 'CS-1000', title: 'Course',
    course: {} as CalendarWeekCourse['course'],
  };
  mounted.push(mount(CalendarCourseContext, {
    target,
    props: {
      course,
      isPinned: true,
      groups: [
        { groupId: 'e1', name: 'H01', type: 'Exercise', studyEvents: [] },
        { groupId: 'e2', name: 'H02', type: 'Exercise', studyEvents: [] },
        { groupId: 'l1', name: 'L01', type: 'Lecture', studyEvents: [] },
      ],
      segments: [],
      visibility: { hiddenGroups: [calendarGroupKey('offer', 'e2')], occurrenceOverrides: {} },
      membersForSegment: () => [],
      onToggleGroup, onToggleOccurrence: vi.fn(),
      onChooseGroup, onShowAll, onClear: vi.fn(),
    },
  }));
  flushSync();
  const choose = () => target.querySelector<HTMLButtonElement>('.choose-mode')!;
  const group = (name: string) => [...target.querySelectorAll<HTMLButtonElement>('.group-preview')]
    .find(element => element.textContent?.trim() === name)!;
  return { target, onChooseGroup, onShowAll, onToggleGroup, choose, group };
}

afterEach(async () => {
  for (const component of mounted.splice(0)) await unmount(component);
  for (const element of targets.splice(0)) element.remove();
});

describe('Calendar group shortcuts (#101)', () => {
  it('selects a group through Choose mode, then returns to normal toggling', () => {
    const { target, onChooseGroup, onToggleGroup, choose, group } = render();
    expect(target.querySelector('.choose-group')).toBeNull();
    expect(choose().textContent?.trim()).toBe('Choose');
    choose().click();
    flushSync();
    expect(choose().getAttribute('aria-pressed')).toBe('true');
    expect(choose().textContent?.trim()).toBe('Cancel');
    expect(group('H01').getAttribute('aria-label')).toContain('Choose H01');

    group('H01').click();
    flushSync();
    expect(onChooseGroup).toHaveBeenCalledTimes(1);
    expect(onChooseGroup).toHaveBeenCalledWith('offer', 'e1', [
      { groupId: 'e1', type: 'Exercises' },
      { groupId: 'e2', type: 'Exercises' },
      { groupId: 'l1', type: 'Lectures' },
    ]);
    expect(onToggleGroup).not.toHaveBeenCalled();
    expect(choose().textContent?.trim()).toBe('Choose');

    group('H02').click();
    expect(onToggleGroup).toHaveBeenCalledWith('offer', 'e2', false);
  });

  it('cancels Choose mode without changing visibility', () => {
    const { choose, onChooseGroup, onToggleGroup, group } = render();
    choose().click();
    flushSync();
    choose().click();
    flushSync();
    expect(choose().getAttribute('aria-pressed')).toBe('false');
    group('H01').click();
    expect(onChooseGroup).not.toHaveBeenCalled();
    expect(onToggleGroup).toHaveBeenCalledWith('offer', 'e1', true);
  });

  it('provides Show all and leaves Choose mode when invoked', () => {
    const { target, choose, onShowAll } = render();
    const button = target.querySelector<HTMLButtonElement>('.show-all')!;
    expect(button.disabled).toBe(false);
    choose().click();
    flushSync();
    button.click();
    flushSync();
    expect(onShowAll).toHaveBeenCalledWith('offer');
    expect(choose().textContent?.trim()).toBe('Choose');
  });
});
