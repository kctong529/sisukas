<script lang="ts">
  import type { CalendarWeekCourse } from '@application/calendar/calendarCoursesForWeek';
  import type { WeeklyCalendarSegment } from '@domain/services/calendar/layout/WeeklyCalendarLayout';
  import type { StudyGroup } from '@domain/models/StudyGroup';
  import type { CalendarVisibility } from '@application/calendar/calendarVisibility';
  import { calendarGroupKey, calendarEntryVisible } from '@application/calendar/calendarVisibility';
  import { formatCalendarMinute } from '@application/calendar/calendarPresentation';
  interface Props {
    course: CalendarWeekCourse;
    groups: readonly StudyGroup[];
    segments: readonly WeeklyCalendarSegment[];
    visibility: CalendarVisibility;
    membersForSegment: (segment: WeeklyCalendarSegment) => readonly import('@domain/models/CalendarEntry').CalendarEntry[];
    onToggleGroup: (offeringId: string, groupId: string, hidden: boolean) => void;
    onToggleOccurrence: (segment: WeeklyCalendarSegment, hidden: boolean) => void;
    onClear: () => void;
  }
  let { course, groups, segments, visibility, membersForSegment, onToggleGroup, onToggleOccurrence, onClear }: Props = $props();
  const groupIds = $derived([...new Set([
    ...groups.map(group => group.groupId),
    ...segments.map(segment => segment.entry.source.studyGroupId),
  ])]);
  const groupDetails = $derived(groupIds.map(groupId => {
    const source = groups.find(group => group.groupId === groupId);
    const occurrences = segments.filter(segment => segment.entry.source.studyGroupId === groupId);
    const first = occurrences[0]?.entry.source;
    return {
      id: groupId, name: source?.name || first?.studyGroupName || groupId,
      type: source?.type || first?.studyGroupType || 'Other',
      occurrences, hidden: visibility.hiddenGroups.includes(calendarGroupKey(course.offeringId, groupId)),
    };
  }).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)));
  function isVisible(segment: WeeklyCalendarSegment): boolean {
    return membersForSegment(segment).some(entry => calendarEntryVisible(entry, visibility));
  }
  function mayChange(segment: WeeklyCalendarSegment): boolean {
    return membersForSegment(segment).every(entry => entry.occurrenceKey !== null);
  }
  const date = (segment: WeeklyCalendarSegment) => new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Helsinki', weekday: 'short', day: 'numeric', month: 'short',
  }).format(new Date(segment.entry.interval.startMs));
</script>
<section class="course-context" aria-label="Course visibility and teaching groups">
  <header><h2>Course details</h2><button type="button" onclick={onClear}>Clear details</button></header>
  <p class="course-code">{course.code}</p>
  <h3>{course.title}</h3>
  <p class="help">Choose which teaching groups and occurrences appear on your timetable. These controls do not change attendance or registration.</p>
  <h4>Teaching groups</h4>
  {#if groupDetails.length}
    {#each groupDetails as group (group.id)}
      <div class="group">
        <div class="group-header">
          <div><strong>{group.name}</strong><small>{group.type} · {group.hidden ? 'Hidden' : 'Visible'}</small></div>
          <button type="button" onclick={() => onToggleGroup(course.offeringId, group.id, !group.hidden)}>
            {group.hidden ? 'Show group' : 'Hide group'}
          </button>
        </div>
        <details>
          <summary>Events this week ({group.occurrences.length})</summary>
          {#if group.occurrences.length}
            <ul>
              {#each group.occurrences as segment (segment.id)}
                <li>
                  <div class="event-label"><span>{date(segment)} · {formatCalendarMinute(segment.startMinute)}–{formatCalendarMinute(segment.endMinute)}</span><small>{isVisible(segment) ? 'Visible' : 'Hidden'}</small></div>
                  <button type="button" disabled={!mayChange(segment)} title={mayChange(segment) ? undefined : 'Ambiguous source identity'}
                    onclick={() => onToggleOccurrence(segment, isVisible(segment))}>{isVisible(segment) ? 'Hide event' : 'Show event'}</button>
                </li>
              {/each}
            </ul>
          {:else}<p class="help">No occurrences in this week. Group visibility applies across weeks.</p>{/if}
        </details>
      </div>
    {/each}
  {:else}<p class="help">Teaching-group data is not available for this offering yet.</p>{/if}
</section>
<style>
  .course-context { padding: 1rem; border: 1px solid var(--calendar-border, #e2e8f0); background: var(--calendar-card, white); border-radius: 8px; min-width: 0; }
  header, .group-header, li { display: flex; justify-content: space-between; align-items: center; gap: .5rem; }
  h2 { margin: 0; font-size: 1rem; } h3 { font-size: .95rem; margin: .3rem 0 .8rem; overflow-wrap: anywhere; } h4 { font-size: .85rem; margin: 1rem 0 .4rem; }
  .course-code { color: var(--calendar-primary, #2f7fd6); font-size: .85rem; font-weight: 700; margin: .7rem 0 0; }
  .help, small { color: var(--calendar-muted, #64748b); font-size: .74rem; line-height: 1.4; }
  .group { border-top: 1px solid var(--calendar-border, #e2e8f0); padding: .65rem 0; }
  .group-header div, .event-label { display: flex; flex-direction: column; gap: .2rem; min-width: 0; }
  strong { font-size: .83rem; } details { margin-top: .45rem; } summary { cursor: pointer; font-size: .78rem; } summary:focus-visible { outline: 2px solid var(--calendar-primary, #2f7fd6); }
  ul { margin: .25rem 0 0; padding: 0; list-style: none; } li { padding: .4rem 0; border-bottom: 1px solid var(--calendar-border, #e2e8f0); } li:last-child { border: 0; }
  button { border: 1px solid var(--calendar-border, #e2e8f0); border-radius: 6px; background: var(--calendar-card, white); color: var(--calendar-primary, #2f7fd6); padding: .3rem .5rem; font: inherit; font-size: .73rem; cursor: pointer; flex: 0 0 auto; }
  button:disabled { opacity: .5; cursor: not-allowed; } button:focus-visible { outline: 2px solid var(--calendar-primary, #2f7fd6); outline-offset: 2px; }
</style>
