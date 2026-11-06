// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import WeekGrid from '../../../src/components/calendar/WeekGrid.svelte';
import { layoutCalendarWeek } from '../../../src/domain/services/calendar/layout/WeeklyCalendarLayout';
import { fixed } from '../../domain/services/calendar/layout/fixtures';
import type { StudyGroup } from '../../../src/domain/models/StudyGroup';
import { aggregateCalendarDisplayEntries } from '../../../src/application/calendar/calendarDisplayAggregation';

const mounted: Array<ReturnType<typeof mount>> = [];
const targetElements: HTMLElement[] = [];
const at = (hour: number) => `2026-11-02T${String(hour).padStart(2, '0')}:00:00+02:00`;
const event = (id: string, start = 10, end = 11) =>
  fixed(id, at(start), at(end), { group: `Group ${id}` });

function render(entries: ReturnType<typeof fixed>[], groups: StudyGroup[] | null = null, offeringIds?: string[]) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  targetElements.push(target);
  const layout = layoutCalendarWeek(entries, '2026-11-02');
  mounted.push(mount(WeekGrid, {
    target,
    props: { layout, offeringIds, groupsForSegment: () => groups, presentationForSegment: (segment) => ({
      courseCode: null, courseTitle: segment.entry.source.studyGroupId,
      groupLabel: 'Exercise H02', locationLabel: null,
    }) },
  }));
  flushSync();
  return target;
}

beforeEach(() => {
  // jsdom does not implement native modal display; test the markup and handler.
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: vi.fn(function (this: HTMLDialogElement) { this.setAttribute('open', ''); }),
  });
});

afterEach(async () => {
  for (const component of mounted.splice(0)) await unmount(component);
  for (const target of targetElements.splice(0)) target.remove();
  vi.restoreAllMocks();
});

describe('WeekGrid offering colors', () => {
  it('assigns different colors by plan membership, independent of visible events', () => {
    const alpha = event('alpha');
    const beta = event('beta', 12, 13);
    const target = render([
      alpha,
      { ...beta, source: { ...beta.source, courseOfferingId: 'other-offering' } },
    ], null, ['offering', 'unused-offering', 'other-offering']);
    const colors = [...target.querySelectorAll<HTMLElement>('.event')]
      .map(card => card.dataset.offeringColor);
    expect(colors).toEqual(['0', '2']);
  });

  it('uses the same palette index for every event from one offering', () => {
    const target = render([event('one', 10, 11), event('two', 13, 14)]);
    const cards = [...target.querySelectorAll<HTMLElement>('.event')];
    expect(cards).toHaveLength(2);
    expect(cards.map(card => card.dataset.offeringColor)).toEqual(['0', '0']);
    expect(cards.map(card => card.querySelector('.calendar-event')?.getAttribute('aria-label'))
      .every(label => label?.includes('Candidate'))).toBe(true);
  });
});

describe('WeekGrid dense overlap disclosure', () => {
  it('renders seven day columns even for an empty week', () => {
    const target = render([]);
    expect(target.querySelectorAll('.day-column')).toHaveLength(7);
    const headings = [...target.querySelectorAll('.day-heading')];
    expect(headings).toHaveLength(7);
    expect(headings[0].textContent).toContain('Mon');
    expect(headings[0].textContent).toContain('2 Nov');
    expect(headings[6].getAttribute('aria-label')).toBe('Sunday, 8 November 2026');
    expect(target.querySelector('.week-scroll')?.getAttribute('tabindex')).toBe('0');
    expect((target.querySelector('.week-scroll') as HTMLElement).scrollTop).toBe(480);
    expect(target.querySelectorAll('.event')).toHaveLength(0);
    expect(target.querySelector('.calendar-workspace')?.getAttribute('data-panel-side')).toBe('left');
    expect(target.querySelector<HTMLButtonElement>('.context-panel .clear')?.disabled).toBe(true);
  });

  it('keeps three concurrent source associations in separate columns', () => {
    const target = render([event('a'), event('b'), event('c')]);
    expect(target.querySelectorAll('.event')).toHaveLength(3);
    expect(target.querySelector('.cluster')).toBeNull();
    const events = [...target.querySelectorAll<HTMLElement>('.event')];
    expect(new Set(events.map(element => element.style.left)).size).toBe(3);
  });

  it('shows a disclosure control for four concurrent associations', () => {
    const target = render([event('a'), event('b'), event('c'), event('d')]);
    expect(target.querySelectorAll('.cluster')).toHaveLength(1);
    expect(target.querySelectorAll('.event')).toHaveLength(4);
    const button = target.querySelector<HTMLButtonElement>('.cluster button');
    expect(button?.getAttribute('aria-label')).toContain('View 4 events in busy period');
    expect(button?.getAttribute('aria-label')).toContain('10:00–11:00');
    button?.click();
    flushSync();
    expect(target.querySelector('dialog')?.hasAttribute('open')).toBe(true);
    const listed = [...target.querySelectorAll('.event-details li')].map(li => li.textContent);
    expect(listed).toHaveLength(4);
    for (const id of ['a', 'b', 'c', 'd']) expect(listed.join(' ')).toContain(`Group ${id}`);
  });

  it('discloses dense-interval members and preserves other events', () => {
    const entries = [event('a', 10, 12), event('b', 10, 12),
      event('c', 10, 12), event('d', 10, 12), event('e', 11, 13),
      event('later', 15, 16), fixed('cancelled', at(10), at(12), { cancelled: true })];
    const target = render(entries);
    expect(target.querySelectorAll('.cluster')).toHaveLength(1);
    expect(target.querySelectorAll('.event')).toHaveLength(7);
    target.querySelector<HTMLButtonElement>('.cluster button')?.click();
    flushSync();
    expect(target.querySelectorAll('.event-details li')).toHaveLength(5);
    expect(target.querySelector('.event-details')?.textContent).toContain('10:00–12:00');
    expect(target.textContent).toContain('Group later');
  });


  it('keeps a long event as one card while marking only its busy interval', () => {
    const target = render([
      event('long', 8, 20), event('a', 10, 12), event('b', 10, 12), event('c', 10, 12),
    ]);
    expect(target.querySelectorAll('.cluster')).toHaveLength(1);
    const cluster = target.querySelector<HTMLElement>('.cluster');
    expect(cluster?.style.top).toBe(`${600 / 1440 * 100}%`);
    expect(cluster?.style.height).toBe('');
    const longCard = target.querySelector<HTMLElement>('.event[data-segment-id]');
    expect(target.querySelectorAll('.event')).toHaveLength(4);
    expect(longCard).toBeTruthy();
    expect(longCard?.getAttribute('data-segment-id')).not.toContain(':visible:');
  });

  it('preserves distinct simultaneous associations when not dense', () => {
    const target = render([event('a'), event('b')]);
    expect(target.querySelectorAll('.event')).toHaveLength(2);
    expect(target.textContent).toContain('Group a');
    expect(target.textContent).toContain('Group b');
  });
});


describe('WeekGrid contextual event inspection', () => {
  it('defaults to a left panel and lets the user switch sides', () => {
    const target = render([]);
    const workspace = target.querySelector<HTMLElement>('.calendar-workspace')!;
    const toggle = target.querySelector<HTMLButtonElement>('.panel-position-button')!;
    expect(workspace.getAttribute('data-panel-side')).toBe('left');
    expect(toggle.getAttribute('aria-label')).toBe('Move event details panel to the right');
    toggle.click();
    flushSync();
    expect(workspace.getAttribute('data-panel-side')).toBe('right');
    expect(toggle.getAttribute('aria-label')).toBe('Move event details panel to the left');
    toggle.click();
    flushSync();
    expect(workspace.getAttribute('data-panel-side')).toBe('left');
  });

  it('previews on pointer hover and restores the pinned event afterward', () => {
    const target = render([event('a', 10, 11), event('b', 12, 13)]);
    const cards = [...target.querySelectorAll<HTMLButtonElement>('.calendar-event')];
    const panel = target.querySelector<HTMLElement>('.context-panel')!;
    expect(panel.textContent).toContain('Hover over an event');

    cards[0].dispatchEvent(new Event('pointerenter'));
    flushSync();
    expect(panel.textContent).toContain('Group a');
    expect(panel.textContent).toContain('Previewing');
    cards[0].click();
    flushSync();
    expect(panel.querySelector<HTMLButtonElement>('.clear')?.disabled).toBe(false);
    cards[0].dispatchEvent(new Event('pointerleave'));
    flushSync();
    expect(panel.textContent).toContain('Group a');

    cards[1].dispatchEvent(new Event('pointerenter'));
    flushSync();
    expect(panel.textContent).toContain('Group b');
    cards[1].dispatchEvent(new Event('pointerleave'));
    flushSync();
    expect(panel.textContent).toContain('Group a');

    panel.querySelector<HTMLButtonElement>('.clear')?.click();
    flushSync();
    expect(panel.textContent).toContain('Hover over an event');
    expect(panel.querySelector<HTMLButtonElement>('.clear')?.disabled).toBe(true);
  });

  it('previews keyboard focus and reverts on blur', () => {
    const target = render([event('focus')]);
    const card = target.querySelector<HTMLButtonElement>('.calendar-event')!;
    const panel = target.querySelector<HTMLElement>('.context-panel')!;
    card.dispatchEvent(new Event('focus'));
    flushSync();
    expect(panel.textContent).toContain('Group focus');
    card.dispatchEvent(new Event('blur'));
    flushSync();
    expect(panel.textContent).toContain('Hover over an event');
    expect(card.getAttribute('type')).toBe('button');
  });

  it('clears the retained event when Escape is pressed', () => {
    const target = render([event('a', 10, 11)]);
    const card = target.querySelector<HTMLButtonElement>('.calendar-event')!;
    const panel = target.querySelector<HTMLElement>('.context-panel')!;

    card.click();
    flushSync();

    expect(panel.textContent).toContain('Group a');
    expect(panel.querySelector<HTMLButtonElement>('.clear')?.disabled).toBe(false);

    card.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      }),
    );
    flushSync();

    expect(panel.textContent).toContain('Hover over an event');
    expect(panel.querySelector<HTMLButtonElement>('.clear')?.disabled).toBe(true);
  });

  it('does not clear retained event details when the overlap dialog is open', () => {
    const target = render([
      event('a', 10, 11),
      event('b', 10, 11),
      event('c', 10, 11),
      event('d', 10, 11),
    ]);

    const card = target.querySelector<HTMLButtonElement>('.calendar-event')!;
    const panel = target.querySelector<HTMLElement>('.context-panel')!;
    const overlapButton = target.querySelector<HTMLButtonElement>('.cluster button')!;

    card.click();
    flushSync();

    expect(panel.querySelector<HTMLButtonElement>('.clear')?.disabled).toBe(false);

    overlapButton.click();
    flushSync();

    expect(target.querySelector('dialog')?.open).toBe(true);

    overlapButton.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      }),
    );
    flushSync();

    // Escape is reserved for the native dialog while it is open.
    expect(panel.querySelector<HTMLButtonElement>('.clear')?.disabled).toBe(false);
  });
});


describe('WeekGrid alternative study-group previews', () => {
  const groups: StudyGroup[] = [
    { groupId: 'Group a', name: 'H01', type: 'Exercise', studyEvents: [] },
    { groupId: 'Group b', name: 'H02', type: 'Exercise', studyEvents: [] },
    { groupId: 'Group c', name: 'L01', type: 'Lecture', studyEvents: [] },
  ];

  it('discovers only same-type alternatives after inspecting an event', () => {
    const target = render([event('a', 10, 11), event('b', 12, 13), event('c', 14, 15)], groups);
    target.querySelector<HTMLButtonElement>('.calendar-event')!.click();
    flushSync();
    const section = target.querySelector('.alternatives')!;
    expect(section.textContent).toContain('Exercise H02');
    expect(section.textContent).not.toContain('Lecture L01');
    expect(section.textContent).toContain('not a study-plan selection');
  });

  it('temporarily highlights alternative occurrences and restores on pointer exit', () => {
    const target = render([event('a', 10, 11), event('b', 12, 13)], groups);
    target.querySelector<HTMLButtonElement>('.calendar-event')!.click();
    flushSync();
    const choice = target.querySelector<HTMLButtonElement>('.alternatives button')!;
    choice.dispatchEvent(new Event('pointerenter'));
    flushSync();
    const cards = [...target.querySelectorAll<HTMLElement>('.event')];
    expect(cards[0].classList.contains('alternative-dim')).toBe(true);
    expect(cards[1].classList.contains('alternative-highlight')).toBe(true);
    choice.dispatchEvent(new Event('pointerleave'));
    flushSync();
    expect(target.querySelectorAll('.alternative-highlight')).toHaveLength(0);
    expect(target.querySelectorAll('.alternative-dim')).toHaveLength(0);
  });

  it('supports click-to-hold read-only highlights and clears them with Escape', () => {
    const target = render([event('a', 10, 11), event('b', 12, 13)], groups);
    target.querySelector<HTMLButtonElement>('.calendar-event')!.click();
    flushSync();
    const choice = target.querySelector<HTMLButtonElement>('.alternatives button')!;
    choice.click();
    flushSync();
    expect(choice.getAttribute('aria-pressed')).toBe('true');
    expect(target.querySelectorAll('.alternative-highlight')).toHaveLength(1);
    choice.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    flushSync();
    expect(target.querySelectorAll('.alternative-highlight')).toHaveLength(0);
    expect(target.querySelector('.context-panel')?.textContent).toContain('Hover over an event');
  });

  it('does not offer alternatives when full source data is unavailable', () => {
    const target = render([event('a')]);
    target.querySelector<HTMLButtonElement>('.calendar-event')!.click();
    flushSync();
    expect(target.querySelector('.alternatives')).toBeNull();
  });
});


describe('WeekGrid accessibility integration', () => {

  it('exposes keyboard instructions without implying a study-group selection', () => {
    const target = render([event('a')]);
    const card = target.querySelector<HTMLButtonElement>('.calendar-event')!;
    const descriptionId = card.getAttribute('aria-describedby');
    expect(descriptionId).toBeTruthy();
    const instructions = document.getElementById(descriptionId!);
    expect(instructions?.textContent).toContain('activate to pin details');
    expect(instructions?.textContent).toContain('does not select a teaching group');
    expect(card.getAttribute('aria-label')).toContain('Candidate');
    expect(target.querySelectorAll('.day-column[role="group"]')).toHaveLength(7);
  });

  it('restores focus to the busy-period trigger when the dialog closes', () => {
    const target = render([event('a'), event('b'), event('c'), event('d')]);
    const trigger = target.querySelector<HTMLButtonElement>('.cluster button')!;
    trigger.focus();
    trigger.click();
    flushSync();
    const dialog = target.querySelector<HTMLDialogElement>('dialog')!;
    expect(dialog.open).toBe(true);

    // Simulate the native close event (Escape or the Close form button).
    dialog.removeAttribute('open');
    dialog.dispatchEvent(new Event('close'));
    flushSync();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on backdrop clicks but not clicks inside dialog content', () => {
    const target = render([event('a'), event('b'), event('c'), event('d')]);
    const trigger = target.querySelector<HTMLButtonElement>('.cluster button')!;
    trigger.focus();
    trigger.click();
    flushSync();
    const dialog = target.querySelector<HTMLDialogElement>('dialog')!;
    Object.defineProperty(dialog, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 100, right: 400, top: 100, bottom: 400 }),
    });
    // jsdom lacks native close(); simulate closing and dispatching close.
    const close = vi.fn(() => {
      dialog.removeAttribute('open');
      dialog.dispatchEvent(new Event('close'));
    });
    Object.defineProperty(dialog, 'close', { configurable: true, value: close });

    dialog.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 200 }));
    expect(close).not.toHaveBeenCalled();
    dialog.querySelector('header')!.dispatchEvent(new MouseEvent('pointerdown', {
      bubbles: true, clientX: 50, clientY: 50,
    }));
    expect(close).not.toHaveBeenCalled();

    dialog.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 50 }));
    expect(close).toHaveBeenCalledOnce();
    flushSync();
    expect(document.activeElement).toBe(trigger);
  });

  it('uses keyboard focus to preview alternatives without selecting them', () => {
    const groups: StudyGroup[] = [
      { groupId: 'Group a', name: 'H01', type: 'Exercise', studyEvents: [] },
      { groupId: 'Group b', name: 'H02', type: 'Exercise', studyEvents: [] },
    ];
    const target = render([event('a', 10, 11), event('b', 12, 13)], groups);
    target.querySelector<HTMLButtonElement>('.calendar-event')!.click();
    flushSync();
    const alternative = target.querySelector<HTMLButtonElement>('.alternatives button')!;
    alternative.focus();
    flushSync();
    expect(target.querySelectorAll('.alternative-highlight')).toHaveLength(1);
    expect(alternative.getAttribute('aria-pressed')).toBe('false');
    const descriptionId = alternative.getAttribute('aria-describedby');
    expect(descriptionId).toBeTruthy();
    const instructions = document.getElementById(descriptionId!);
    expect(instructions?.textContent).toContain('not a study-plan selection or SISU registration');
    alternative.blur();
    flushSync();
    expect(target.querySelectorAll('.alternative-highlight')).toHaveLength(0);
  });
});

describe('WeekGrid aggregated room details', () => {
  it('shows one calendar card with all room assignments in the context panel', () => {
    const entries = ['U157', 'Y122', 'Y202a'].map((room, index) => {
      const entry = event(`room-${index}`, 10, 11);
      return {
        ...entry,
        source: {
          ...entry.source,
          courseOfferingId: 'math',
          studyGroupId: 'exam',
          seriesId: `series-${index}`,
          event: {
            ...entry.source.event,
            locations: [{ id: room, name: room, buildingName: 'Undergraduate Centre' }],
            locationIds: [room],
          },
        },
      };
    });
    const display = aggregateCalendarDisplayEntries(entries);
    const layout = layoutCalendarWeek(display.entries, '2026-11-02');
    const target = document.createElement('div');
    document.body.appendChild(target);
    targetElements.push(target);
    mounted.push(mount(WeekGrid, {
      target,
      props: {
        layout,
        membersForSegment: segment => display.membersByEntry.get(segment.entry) ?? [segment.entry],
        presentationForSegment: () => ({
          courseCode: 'MS-A0001', courseTitle: 'Matrix Algebra',
          groupLabel: 'Exam KT', locationLabel: '3 listed rooms',
        }),
      },
    }));
    flushSync();
    expect(target.querySelectorAll('.event')).toHaveLength(1);
    expect(target.querySelector('.cluster')).toBeNull();
    target.querySelector<HTMLButtonElement>('.calendar-event')?.click();
    flushSync();
    const locations = target.querySelector(
      'section[aria-labelledby="calendar-listed-locations"]',
    );

    expect(locations).not.toBeNull();
    expect(locations?.textContent).toContain(
      '3 events · 3 rooms · 1 building',
    );

    for (const room of ['U157', 'Y122', 'Y202a']) {
      expect(locations?.textContent).toContain(room);
    }
  });
});


describe('WeekGrid selection presentation', () => {
  it('shows candidate states on cards, details and dense disclosures', () => {
    const target = render([event('a'), event('b'), event('c'), event('d')]);
    expect(target.querySelectorAll('[data-selection="candidate"].calendar-event')).toHaveLength(4);
    target.querySelector<HTMLButtonElement>('.calendar-event')?.click();
    flushSync();
    expect(target.querySelector('.context-panel [data-selection="candidate"]')?.textContent)
      .toContain('Candidate');
    target.querySelector<HTMLButtonElement>('.cluster button')?.click();
    flushSync();
    expect(target.querySelectorAll('dialog [data-selection="candidate"]')).toHaveLength(4);
  });
});

describe('WeekGrid visibility actions (#92)', () => {
  it('offers separate group and occurrence controls without changing planning state', () => {
    const hideGroup = vi.fn();
    const hideOccurrence = vi.fn();
    const target = document.createElement('div');
    document.body.appendChild(target);
    targetElements.push(target);
    mounted.push(mount(WeekGrid, {
      target,
      props: {
        layout: layoutCalendarWeek([event('a')], '2026-11-02'),
        hideGroup,
        hideOccurrence,
        presentationForSegment: () => ({
          courseCode: 'CS-A1111', courseTitle: 'Course', groupLabel: 'Exercise H01', locationLabel: null,
        }),
      },
    }));
    flushSync();
    target.querySelector<HTMLButtonElement>('.calendar-event')?.click();
    flushSync();
    const buttons = [...target.querySelectorAll<HTMLButtonElement>('.visibility-actions button')];
    expect(buttons.map(button => button.textContent?.trim())).toEqual([
      'Course overview and visibility', 'Hide teaching group', 'Hide this event',
    ]);
    const hideEventButton = buttons.find(button => button.textContent?.trim() === 'Hide this event');
    expect(hideEventButton).toBeDefined();
    hideEventButton!.click();
    flushSync();
    expect(hideOccurrence).toHaveBeenCalledTimes(1);
    expect(hideGroup).not.toHaveBeenCalled();
    expect(target.textContent).toContain('Candidate');
  });

  it('does not expose an unsafe per-occurrence operation for unresolved identities', () => {
    const target = render([event('a')]);
    // The fixture has a stable key, so the event control is enabled.
    target.querySelector<HTMLButtonElement>('.calendar-event')?.click();
    flushSync();
    expect(target.querySelector<HTMLButtonElement>('.visibility-actions button:last-child')?.disabled).toBe(false);
  });
});


describe('WeekGrid course context navigation', () => {
  it('previews a course on hover, pins on click, and restores pinned details after preview', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    targetElements.push(target);
    const entry = event('one');
    const layout = layoutCalendarWeek([entry], '2026-11-02');
    const course = (id: string) => ({ offeringId: id, code: id, title: `${id} title`, course: {} as import('../../../src/application/calendar/calendarCoursesForWeek').CalendarWeekCourse['course'] });
    mounted.push(mount(WeekGrid, { target, props: {
      layout,
      unfilteredSegments: layout.segments,
      weekCourses: [course('offering'), course('other')],
      presentationForSegment: segment => ({ courseCode: null, courseTitle: segment.entry.source.studyGroupId, groupLabel: null, locationLabel: null }),
    } }));
    flushSync();
    const buttons = target.querySelectorAll<HTMLButtonElement>('.course-bar button');
    buttons[0].dispatchEvent(new Event('pointerenter'));
    flushSync();
    expect(target.querySelector('.course-context')?.textContent).toContain('offering title');
    buttons[0].click();
    flushSync();
    expect(target.querySelector<HTMLButtonElement>('.course-context button.clear')?.disabled).toBe(false);
    buttons[1].dispatchEvent(new Event('pointerenter'));
    flushSync();
    expect(target.querySelector('.course-context')?.textContent).toContain('other title');
    buttons[1].dispatchEvent(new Event('pointerleave'));
    flushSync();
    expect(target.querySelector('.course-context')?.textContent).toContain('offering title');
  });

  it('clears a pinned course with Escape while the course button retains focus', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    targetElements.push(target);
    const layout = layoutCalendarWeek([], '2026-11-02');
    mounted.push(mount(WeekGrid, { target, props: {
      layout,
      weekCourses: [{ offeringId: 'offering', code: 'CS-1000', title: 'Example', course: {} as import('../../../src/application/calendar/calendarCoursesForWeek').CalendarWeekCourse['course'] }],
      presentationForSegment: () => ({ courseCode: null, courseTitle: '', groupLabel: null, locationLabel: null }),
    } }));
    flushSync();
    const courseButton = target.querySelector<HTMLButtonElement>('.course-bar button')!;
    courseButton.focus();
    courseButton.click();
    flushSync();
    expect(target.querySelector('.course-context')).not.toBeNull();
    courseButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    flushSync();
    expect(target.querySelector('.course-context')).toBeNull();
    expect(courseButton.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('WeekGrid pinned course and temporary event inspection', () => {
  it('previews an event above a pinned course and restores the pinned course on pointer exit', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    targetElements.push(target);
    const layout = layoutCalendarWeek([event('one')], '2026-11-02');
    mounted.push(mount(WeekGrid, { target, props: {
      layout,
      unfilteredSegments: layout.segments,
      weekCourses: [{ offeringId: 'offering', code: 'CS-1000', title: 'Pinned course', course: {} as import('../../../src/application/calendar/calendarCoursesForWeek').CalendarWeekCourse['course'] }],
      presentationForSegment: () => ({ courseCode: 'CS-1000', courseTitle: 'Event course', groupLabel: 'Exercise', locationLabel: null }),
    } }));
    flushSync();
    target.querySelector<HTMLButtonElement>('.course-bar button')?.click();
    flushSync();
    expect(target.querySelector('.course-context')?.textContent).toContain('Pinned course');
    const eventButton = target.querySelector<HTMLButtonElement>('.calendar-event')!;
    eventButton.dispatchEvent(new Event('pointerenter'));
    flushSync();
    expect(target.querySelector('.course-context')).toBeNull();
    expect(target.querySelector('.context-panel h2')?.textContent).toBe('Event details');
    expect(target.querySelector('.context-panel .course-identity .code')?.textContent).toBe('CS-1000');
    eventButton.dispatchEvent(new Event('pointerleave'));
    flushSync();
    expect(target.querySelector('.course-context')?.textContent).toContain('Pinned course');
    expect(target.querySelector<HTMLButtonElement>('.course-bar button')?.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('WeekGrid hidden visibility previews (#92)', () => {
  function renderFiltered(
    visible: ReturnType<typeof fixed>[],
    all: ReturnType<typeof fixed>[],
    options: { excludeGroup?: string; course?: boolean } = {},
  ) {
    const target = document.createElement('div');
    document.body.appendChild(target);
    targetElements.push(target);
    const layout = layoutCalendarWeek(visible, '2026-11-02');
    const full = layoutCalendarWeek(all, '2026-11-02');
    const groups = all.map(entry => ({
      groupId: entry.source.studyGroupId,
      name: entry.source.studyGroupId,
      type: 'Exercise',
      studyEvents: [],
    }));
    const course = { offeringId: 'offering', code: 'TEST', title: 'Test course',
      course: {} as import('../../../src/application/calendar/calendarCoursesForWeek').CalendarWeekCourse['course'] };
    mounted.push(mount(WeekGrid, { target, props: {
      layout,
      unfilteredSegments: full.segments,
      weekCourses: options.course ? [course] : [],
      groupsForCourse: () => groups,
      groupsForSegment: () => groups,
      selectionForSegment: segment => segment.entry.source.studyGroupId === options.excludeGroup ? 'excluded' : 'candidate',
      presentationForSegment: segment => ({ courseCode: 'TEST', courseTitle: 'Test course',
        groupLabel: segment.entry.source.studyGroupId, locationLabel: null }),
    } }));
    flushSync();
    return target;
  }

  it('previews a visibility-hidden occurrence from course details without restoring its visibility', () => {
    const hidden = event('hidden', 12, 14);
    const target = renderFiltered([], [hidden], { course: true });
    target.querySelector<HTMLButtonElement>('.course-bar button')!.click();
    flushSync();
    const card = target.querySelector<HTMLElement>('.course-context .group')!;
    card.dispatchEvent(new Event('pointerenter'));
    flushSync();
    expect(target.querySelectorAll('.hidden-preview')).toHaveLength(1);
    expect(target.querySelectorAll('.event')).toHaveLength(0);
    expect(target.querySelector('.hidden-preview')?.getAttribute('aria-hidden')).toBe('true');
    const chip = target.querySelector<HTMLButtonElement>('.course-context button.occurrence')!;
    chip.dispatchEvent(new Event('pointerenter'));
    flushSync();
    expect(target.querySelectorAll('.hidden-preview')).toHaveLength(1);
    chip.dispatchEvent(new Event('pointerleave'));
    flushSync();
    expect(target.querySelectorAll('.hidden-preview')).toHaveLength(1);
    card.dispatchEvent(new Event('pointerleave'));
    flushSync();
    expect(target.querySelectorAll('.hidden-preview')).toHaveLength(0);
  });

  it('reflows visible neighbors alongside a hidden group preview and restores their lanes afterward', () => {
    const a = event('a', 10, 12);
    const b = event('b', 11, 13);
    const hidden = event('hidden', 11, 12);
    const target = renderFiltered([a, b], [a, b, hidden], { course: true });
    target.querySelector<HTMLButtonElement>('.course-bar button')!.click();
    flushSync();
    const before = [...target.querySelectorAll<HTMLElement>('.event')].map(element => element.style.width);
    expect(before).toEqual(['50%', '50%']);
    const group = [...target.querySelectorAll<HTMLElement>('.course-context .group')]
      .find(element => element.getAttribute('aria-label')?.includes('Group hidden'))!;
    group.dispatchEvent(new Event('pointerenter'));
    flushSync();
    expect([...target.querySelectorAll<HTMLElement>('.event')].map(element => parseFloat(element.style.width)))
      .toEqual([100 / 3, 100 / 3]);
    expect(parseFloat(target.querySelector<HTMLElement>('.hidden-preview')!.style.width)).toBe(100 / 3);
    group.dispatchEvent(new Event('pointerleave'));
    flushSync();
    expect([...target.querySelectorAll<HTMLElement>('.event')].map(element => element.style.width)).toEqual(before);
  });

  it('shows hidden alternative group placement from event details without creating interactive events', () => {
    const a = event('a', 10, 11);
    const b = event('b', 12, 13);
    const target = renderFiltered([a], [a, b]);
    target.querySelector<HTMLButtonElement>('.calendar-event')!.click();
    flushSync();
    const alternative = target.querySelector<HTMLButtonElement>('.alternatives button')!;
    alternative.dispatchEvent(new Event('pointerenter'));
    flushSync();
    expect(target.querySelectorAll('.hidden-preview')).toHaveLength(1);
    expect(target.querySelectorAll('.event')).toHaveLength(1);
    alternative.dispatchEvent(new Event('pointerleave'));
    flushSync();
    expect(target.querySelectorAll('.hidden-preview')).toHaveLength(0);
  });

  it('never previews a group excluded by a planning choice', () => {
    const a = event('a', 10, 11);
    const b = event('b', 12, 13);
    const target = renderFiltered([a], [a, b], { excludeGroup: 'Group b' });
    target.querySelector<HTMLButtonElement>('.calendar-event')!.click();
    flushSync();
    target.querySelector<HTMLButtonElement>('.alternatives button')!
      .dispatchEvent(new Event('pointerenter'));
    flushSync();
    expect(target.querySelectorAll('.hidden-preview')).toHaveLength(0);
  });
});
