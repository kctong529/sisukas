<script lang="ts">
  interface Props {
    kind: 'Course' | 'Event';
    titleId: string;
    code: string | null;
    title: string;
    isPinned: boolean;
    onClear: () => void;
  }
  let { kind, titleId, code, title, isPinned, onClear }: Props = $props();
</script>
<header class="details-heading">
  <h2 id={titleId}>{kind} details</h2>
  <button type="button" class="clear" onclick={onClear} disabled={!isPinned}>Clear details</button>
</header>
{#if code || title}
  <div class="course-identity">
    {#if code}<p class="code">{code}</p>{/if}
    <h3>{title}</h3>
  </div>
{/if}
<style>
  .details-heading { display: flex; align-items: center; justify-content: space-between; gap: .5rem; margin-bottom: .75rem; }
  h2 { font-size: 1rem; font-weight: 600; margin: 0; }
  .clear { border: 1px solid var(--calendar-border, #e2e8f0); background: var(--calendar-card, #fff); color: var(--calendar-text, #1e293b); border-radius: 6px; padding: .4rem .7rem; cursor: pointer; font: inherit; font-size: .75rem; }
  .clear:hover:not(:disabled) { border-color: var(--calendar-primary, #2f7fd6); background: #f1f5f9; }
  .clear:focus-visible { outline: 2px solid var(--calendar-primary, #2f7fd6); outline-offset: 2px; }
  .clear:disabled { opacity: .55; cursor: not-allowed; }
  .course-identity { min-height: 0; }
  .code { font-size: .85rem; font-weight: 700; color: var(--calendar-primary, #2f7fd6); margin: 0; }
  h3 { font-size: .95rem; margin: .25rem 0 .75rem; overflow-wrap: anywhere; }
</style>
