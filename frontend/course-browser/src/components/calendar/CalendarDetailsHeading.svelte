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
  <button type="button" class="ui-button ui-button--secondary clear" onclick={onClear} disabled={!isPinned}>Clear details</button>
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
  .clear { height: auto; min-height: 32.5px; padding: .4rem .7rem; font-size: .75rem; }
  .course-identity { min-height: 0; }
  .code { font-size: .85rem; font-weight: 700; color: var(--calendar-primary, #2f7fd6); margin: 0; }
  h3 { font-size: .95rem; margin: .25rem 0 .75rem; overflow-wrap: anywhere; }
</style>
