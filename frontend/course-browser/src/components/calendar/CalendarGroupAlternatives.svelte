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
  .alternatives { margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--calendar-border, #e2e8f0); }
  h4 { margin: 0 0 0.35rem; font-size: 0.9rem; }
  .explanation { color: var(--calendar-muted, #64748b); font-size: 0.78rem; line-height: 1.45; margin: 0.3rem 0 0.65rem; }
  ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.4rem; }
  button { width: 100%; background: #f8fafc; color: var(--calendar-text, #1e293b); border: 1px solid var(--calendar-border, #e2e8f0); border-radius: 6px; padding: 0.45rem 0.6rem; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 0.2rem; font: inherit; font-size: 0.8rem; }
  button:hover { border-color: var(--calendar-primary, #2f7fd6); background: #eff6ff; }
  button.previewed { border-color: var(--calendar-primary, #2f7fd6); background: #dbeafe; }
  button:focus-visible { outline: 2px solid var(--calendar-primary, #2f7fd6); outline-offset: 2px; }
  .count { color: var(--calendar-muted, #64748b); font-size: 0.75rem; }
</style>
