<script lang="ts">
  import type { CalendarGroupAlternative } from '@application/calendar/calendarGroupAlternatives';

  interface Props {
    alternatives: readonly CalendarGroupAlternative[];
    previewGroupId: string | null;
    retainedGroupId: string | null;
    onPreview: (id: string | null) => void;
    onTogglePreview: (id: string) => void;
    onChoose?: (id: string) => void;
    contextKey?: string | null;
  }
  let { alternatives, previewGroupId, retainedGroupId, onPreview, onTogglePreview,
    onChoose = () => {}, contextKey = null }: Props = $props();
  let choosingGroup = $state(false);
  let previousContext: string | null = null;
  $effect(() => {
    const currentContext = contextKey;
    if (previousContext !== null && currentContext !== previousContext) choosingGroup = false;
    previousContext = currentContext;
  });
  function activateAlternative(id: string): void {
    if (!choosingGroup) {
      onTogglePreview(id);
      return;
    }
    choosingGroup = false;
    onPreview(null);
    onChoose(id);
  }
  const instructionId = $props.id();
</script>

{#if alternatives.length > 0}
  <section class="alternatives" aria-labelledby="calendar-alternatives-title">
    <div class="alternatives-heading">
      <h4 id="calendar-alternatives-title">Alternative teaching groups</h4>
      <button type="button" class="choose-mode" class:active={choosingGroup}
        aria-pressed={choosingGroup}
        onclick={() => { choosingGroup = !choosingGroup; onPreview(null); }}>
        {choosingGroup ? 'Cancel' : 'Choose'}
      </button>
    </div>
    <p id={instructionId} class="explanation">
      {#if choosingGroup}
        Select a group to hide other groups of the same type.
      {:else}
        Hover or focus to preview; click a group to keep the preview.
      {/if}
    </p>
    <ul>
      {#each alternatives as alternative (alternative.groupId)}
        <li>
          <button
            type="button"
            class:previewed={previewGroupId === alternative.groupId}
            class:choosing={choosingGroup}
            aria-pressed={choosingGroup ? undefined : retainedGroupId === alternative.groupId}
            aria-label={choosingGroup ? `Choose ${alternative.label} and hide alternatives` : alternative.label}
            aria-describedby={instructionId}
            onpointerenter={() => onPreview(alternative.groupId)}
            onpointerleave={() => onPreview(null)}
            onfocus={() => onPreview(alternative.groupId)}
            onblur={() => onPreview(null)}
            onclick={() => activateAlternative(alternative.groupId)}
          >
            <span>{alternative.label}</span>
          </button>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .alternatives { margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--calendar-border, #e2e8f0); }
  .alternatives-heading { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
  h4 { margin: 0; font-size: 0.9rem; }
  button.choose-mode { width: auto; flex: 0 0 auto; padding: 0.3rem 0.55rem; }
  .choose-mode.active { border-color: var(--calendar-primary, #2f7fd6); background: #dbeafe; }
  button.choosing { border-style: dashed; cursor: pointer; }
  .explanation { min-height: 2.8em; color: var(--calendar-muted, #64748b); font-size: 0.78rem; line-height: 1.45; margin: 0.3rem 0 0.65rem; }
  ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.4rem; }
  button { width: 100%; background: #f8fafc; color: var(--calendar-text, #1e293b); border: 1px solid var(--calendar-border, #e2e8f0); border-radius: 6px; padding: 0.45rem 0.6rem; text-align: left; cursor: pointer; display: flex; flex-direction: column; gap: 0.2rem; font: inherit; font-size: 0.8rem; }
  button:hover { border-color: var(--calendar-primary, #2f7fd6); background: #eff6ff; }
  button.previewed { border-color: var(--calendar-primary, #2f7fd6); background: #dbeafe; }
  button:focus-visible { outline: 2px solid var(--calendar-primary, #2f7fd6); outline-offset: 2px; }
</style>
