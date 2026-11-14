<script lang="ts">
  import { calendarLocationGroups } from '@application/calendar/calendarLocationGroups';

  import type { CalendarEntry } from '@domain/models/CalendarEntry';

  interface Props {
    members: readonly CalendarEntry[];
  }

  let { members }: Props = $props();
  const summary = $derived(calendarLocationGroups(members));
</script>

<section class="locations" aria-labelledby="calendar-listed-locations">
  <h4 id="calendar-listed-locations">Listed locations</h4>
  <p class="count">
    {members.length} events · {summary.roomCount} rooms · {summary.buildingCount} {summary.buildingCount === 1 ? 'building' : 'buildings'}
  </p>
  <p class="note">Listed locations from SISU. Room assignment is not determined by Sisukas.</p>

  {#if summary.groups.length > 0}
    <ul class="buildings">
      {#each summary.groups as group (group.key)}
        <li class="building">
          <h5>{group.building} <span>· {group.rooms.length} {group.rooms.length === 1 ? 'room' : 'rooms'}</span></h5>
          <ul class="rooms">
            {#each group.rooms as room (room)}
              <li>{room}</li>
            {/each}
          </ul>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="note">No room information available.</p>
  {/if}
</section>

<style>
  .locations { margin-top: 1rem; min-width: 0; font-size: 0.8rem; }
  h4 { font-size: .9rem; margin: 0 0 4px; }
  .count { margin: 0 0 0.5rem; color: var(--calendar-muted, #64748b); }
  .note { margin: 0 0 0.75rem; line-height: 1.45; color: var(--calendar-muted, #64748b); }
  .buildings, .rooms { list-style: none; margin: 0; padding: 0; }
  .buildings { display: grid; gap: 12px; }
  h5 { margin: 0 0 6px; font-size: .82rem; font-weight: 650; overflow-wrap: anywhere; }
  h5 span { font-size: 0.75rem; font-weight: 400; color: var(--calendar-muted, #64748b); }
  .rooms { display: flex; flex-wrap: wrap; gap: 5px; }
  .rooms li { max-width: 100%; box-sizing: border-box; padding: 4px 7px; border-radius: 4px; background: #f1f5f9; color: #334155; font-size: .78rem; line-height: 1.35; overflow-wrap: anywhere; }
</style>
