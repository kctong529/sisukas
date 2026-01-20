<!-- src/components/DebugPanels.svelte -->
<script lang="ts">
  import AuthDebugPanel from './AuthDebugPanel.svelte';
  import StudyGroupStoreDebug from './StudyGroupStoreDebug.svelte';
  import PlansStoreDebug from './PlansStoreDebug.svelte';
  import BlockStoreDebug from './BlockStoreDebug.svelte';

  const debugAuthStore = import.meta.env.VITE_DEBUG_AUTH === 'true';
  const debugStudyGroupStore = import.meta.env.VITE_DEBUG_STUDY_GROUP_STORE === 'true';
  const debugPlanStore = import.meta.env.VITE_DEBUG_PLAN_STORE === 'true';
  const debugBlockStore = import.meta.env.VITE_DEBUG_BLOCK_STORE === 'true';

  const panelsToShow = [
    { name: 'AuthDebugPanel', show: debugAuthStore, component: AuthDebugPanel },
    { name: 'StudyGroupStoreDebug', show: debugStudyGroupStore, component: StudyGroupStoreDebug },
    { name: 'PlansStoreDebug', show: debugPlanStore, component: PlansStoreDebug },
    { name: 'BlockStoreDebug', show: debugBlockStore, component: BlockStoreDebug },
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
    --panel-height: 30px;
    --panel-gap: 1rem;
    --panel-bottom: 1rem;
    --panel-right: 1rem;
  }

  .debug-panel-wrapper {
    position: fixed;
    bottom: calc(var(--panel-bottom) + (var(--panel-index) * (var(--panel-height) + var(--panel-gap))));
    right: var(--panel-right);
    z-index: calc(9999 - var(--panel-index));
  }

  /* Override individual panel positioning */
  :global(.debug-panel) {
    position: static !important;
    bottom: auto !important;
    right: auto !important;
    transform: none !important;
  }
</style>