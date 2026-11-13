<script lang="ts">
  import type { CalendarWeekCourse } from '@application/calendar/calendarCoursesForWeek';
  interface Props {
    courses: readonly CalendarWeekCourse[];
    selectedOfferingId: string | null;
    colorByOffering: Readonly<Record<string, number>>;
    onSelect: (offeringId: string) => void;
    onPreview: (offeringId: string | null) => void;
  }
  let { courses, selectedOfferingId, colorByOffering, onSelect, onPreview }: Props = $props();
</script>
<nav class="course-bar" aria-label="Courses active this week">
  <span class="bar-heading">Courses</span>
  {#if courses.length}
    <div class="course-list">
      {#each courses as course (course.offeringId)}
        <button type="button" class:active={selectedOfferingId === course.offeringId}
          data-offering-color={colorByOffering[course.offeringId] ?? 0}
          title={`${course.code} — ${course.title}`}
          aria-pressed={selectedOfferingId === course.offeringId}
          onclick={() => onSelect(course.offeringId)}
          onpointerenter={() => onPreview(course.offeringId)}
          onpointerleave={() => onPreview(null)}
          onfocus={() => onPreview(course.offeringId)}
          onblur={() => onPreview(null)}>{course.code}</button>
      {/each}
    </div>
  {:else}
    <span class="empty">No courses overlap this week.</span>
  {/if}
</nav>
<style>
  .course-bar { display: flex; align-items: center; min-width: 0; gap: .65rem; border: 1px solid var(--calendar-border, #e2e8f0); border-radius: 8px; padding: .4rem .65rem; margin-bottom: .7rem; background: var(--calendar-card, white); }
  .bar-heading { font-size: .8rem; font-weight: 700; flex: 0 0 auto; }
  .course-list { display: flex; gap: .4rem; overflow-x: auto; min-width: 0; padding: .1rem; scrollbar-width: thin; }
  /* Match calendar event cards: shared palette, full-color border, and 14% tint. */
  button {
    font: inherit;
    font-size: .77rem;
    font-weight: 600;
    white-space: nowrap;
    border: 1px solid rgb(var(--offering-rgb, 47, 127, 214));
    background: color-mix(in srgb, rgb(var(--offering-rgb, 47, 127, 214)) 14%, white);
    color: color-mix(in srgb, rgb(var(--offering-rgb, 47, 127, 214)) 60%, black);
    border-radius: 4px;
    cursor: pointer;
    padding: .34rem .55rem;
  }
  button[data-offering-color="0"] { --offering-rgb: 234, 88, 12; }
  button[data-offering-color="1"] { --offering-rgb: 21, 128, 61; }
  button[data-offering-color="2"] { --offering-rgb: 124, 58, 237; }
  button[data-offering-color="3"] { --offering-rgb: 2, 132, 199; }
  button[data-offering-color="4"] { --offering-rgb: 245, 158, 11; }
  button[data-offering-color="5"] { --offering-rgb: 219, 39, 119; }
  button[data-offering-color="6"] { --offering-rgb: 13, 148, 136; }
  button[data-offering-color="7"] { --offering-rgb: 79, 70, 229; }
  button[data-offering-color="8"] { --offering-rgb: 190, 24, 93; }
  button[data-offering-color="9"] { --offering-rgb: 101, 163, 13; }
  button[data-offering-color="10"] { --offering-rgb: 180, 83, 9; }
  button[data-offering-color="11"] { --offering-rgb: 8, 145, 178; }
  button:hover {
    background: color-mix(in srgb, rgb(var(--offering-rgb, 47, 127, 214)) 20%, white);
  }
  button.active {
    background: color-mix(in srgb, rgb(var(--offering-rgb, 47, 127, 214)) 20%, white);
    box-shadow: inset 0 0 0 1px rgb(var(--offering-rgb, 47, 127, 214));
  }
  button:focus-visible { outline: 2px solid var(--calendar-primary, #2f7fd6); outline-offset: 2px; }
  .empty { color: var(--calendar-muted, #64748b); font-size: .8rem; }
</style>
