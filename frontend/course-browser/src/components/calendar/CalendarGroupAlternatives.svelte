<script lang="ts">
  import type { CalendarGroupAlternative } from '@application/calendar/calendarGroupAlternatives';

  interface Props {
    alternatives: readonly CalendarGroupAlternative[];
    previewGroupId: string | null;
    retainedGroupId: string | null;
    onPreview: (id: string | null) => void;
    onTogglePreview: (id: string) => void;
  }
  let { alternatives, previewGroupId, retainedGroupId, onPreview, onTogglePreview }: Props = $props();
  const instructionId = $props.id();
</script>

{#if alternatives.length > 0}
  <section class="alternatives" aria-labelledby="calendar-alternatives-title">
    <h4 id="calendar-alternatives-title">Alternative teaching groups</h4>
    <p id={instructionId} class="explanation">Same offering and teaching type. Preview only — not a study-plan selection or SISU registration. Focus to highlight temporarily; activate to keep the highlight.</p>
    <ul>
      {#each alternatives as alternative (alternative.groupId)}
        <li>
          <button
            type="button"
            class:previewed={previewGroupId === alternative.groupId}
            aria-pressed={retainedGroupId === alternative.groupId}
            aria-describedby={instructionId}
            onpointerenter={() => onPreview(alternative.groupId)}
            onpointerleave={() => onPreview(null)}
            onfocus={() => onPreview(alternative.groupId)}
            onblur={() => onPreview(null)}
            onclick={() => onTogglePreview(alternative.groupId)}
          >
            <span>{alternative.label}</span>
            <span class="count">{alternative.eventCount} source events</span>
          </button>
        </li>
      {/each}
    </ul>
    <p class="explanation">Highlighted occurrences are already present in this week's candidate calendar. Groups without events this week cannot be highlighted.</p>
  </section>
{/if}

<style>
  .alternatives { margin-top: 16px; padding-top: 14px; border-top: 1px solid #dce4ee; }
  h4 { margin: 0 0 6px; font-size: .9rem; }
  .explanation { color: #475569; font-size: .78rem; line-height: 1.45; margin: 5px 0 10px; }
  ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
  button { width: 100%; background: #f8fafc; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 5px; padding: 7px 9px; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 3px; }
  button.previewed { border-color: #2563eb; background: #dbeafe; }
  button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
  .count { color: #475569; font-size: .75rem; }
</style>
