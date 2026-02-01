<!-- src/components/DebugPanels.svelte -->
<script lang="ts">
  import '../styles/debug-panels.css';
  import AuthDebugPanel from './AuthDebugPanel.svelte';
  import StudyGroupStoreDebug from './StudyGroupStoreDebug.svelte';
  import PlansStoreDebug from './PlansStoreDebug.svelte';
  import BlockStoreDebug from './BlockStoreDebug.svelte';
  import PeriodTimelineStoreDebug from './PeriodTimelineStoreDebug.svelte';

  const debugAuthStore = import.meta.env.VITE_DEBUG_AUTH === 'true';
  const debugStudyGroupStore = import.meta.env.VITE_DEBUG_STUDY_GROUP_STORE === 'true';
  const debugPlanStore = import.meta.env.VITE_DEBUG_PLAN_STORE === 'true';
  const debugBlockStore = import.meta.env.VITE_DEBUG_BLOCK_STORE === 'true';
  const debugPeriodTimelineStore = import.meta.env.VITE_DEBUG_PERIOD_TIMELINE_STORE === 'true';

  const panelsToShow = [
    { name: 'StudyGroupStoreDebug', show: debugStudyGroupStore, component: StudyGroupStoreDebug },
    { name: 'PlansStoreDebug', show: debugPlanStore, component: PlansStoreDebug },
    { name: 'BlockStoreDebug', show: debugBlockStore, component: BlockStoreDebug },
    { name: 'PeriodTimelineStoreDebug', show: debugPeriodTimelineStore, component: PeriodTimelineStoreDebug },
    { name: 'AuthDebugPanel', show: debugAuthStore, component: AuthDebugPanel },
  ].filter(p => p.show);
</script>

<div class="debug-panels-container">
  {#each panelsToShow as panel, index (panel.name)}
    <div class="debug-panel-wrapper" style="--panel-index: {index}">
      <svelte:component this={panel.component} />
    </div>
  {/each}
</div>

<style>
  .debug-panels-container {
    --panel-gap: 0.75rem;
    --panel-bottom: 1rem;
    --panel-right: 1rem;
    --panel-step: calc(30px + var(--panel-gap));
  }

  .debug-panel-wrapper {
    position: fixed;
    right: var(--panel-right);
    bottom: calc(var(--panel-bottom) + var(--panel-index) * var(--panel-step));
    z-index: calc(9999 - var(--panel-index));
  }
</style>
