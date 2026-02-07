<!-- src/components/DebugPanels.svelte -->
<script lang="ts">
  import '../../styles/debug-panels.css';

  const ENV = import.meta.env.VITE_ENVIRONMENT; // "development" | "test" | "production"
  const DEBUG_ALLOWED = import.meta.env.VITE_DEBUG_PANELS === 'true';
  const ENABLE_DEBUG_PANELS = (ENV === 'development' || ENV === 'test') && DEBUG_ALLOWED;
  
  const flags = {
    StudyGroupStoreDebug:
      ENABLE_DEBUG_PANELS && import.meta.env.VITE_DEBUG_STUDY_GROUP_STORE === 'true',
    CourseIndexDebug:
      ENABLE_DEBUG_PANELS && import.meta.env.VITE_DEBUG_COURSE_INDEX === 'true',
    PlansStoreDebug:
      ENABLE_DEBUG_PANELS && import.meta.env.VITE_DEBUG_PLAN_STORE === 'true',
    BlockStoreDebug:
      ENABLE_DEBUG_PANELS && import.meta.env.VITE_DEBUG_BLOCK_STORE === 'true',
    PeriodTimelineStoreDebug:
      ENABLE_DEBUG_PANELS && import.meta.env.VITE_DEBUG_PERIOD_TIMELINE_STORE === 'true',
    AuthDebugPanel:
      ENABLE_DEBUG_PANELS && import.meta.env.VITE_DEBUG_AUTH === 'true',
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loaders: Record<string, () => Promise<{ default: any }>> = {
    StudyGroupStoreDebug: () => import('./StudyGroupStoreDebug.svelte'),
    CourseIndexDebug: () => import('./CourseIndexDebug.svelte'),
    PlansStoreDebug: () => import('./PlansStoreDebug.svelte'),
    BlockStoreDebug: () => import('./BlockStoreDebug.svelte'),
    PeriodTimelineStoreDebug: () => import('./PeriodTimelineStoreDebug.svelte'),
    AuthDebugPanel: () => import('./AuthDebugPanel.svelte'),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Panel = { name: string; module: any };
  let panels: Panel[] = [];

  if (ENABLE_DEBUG_PANELS && Object.values(flags).some(Boolean)) {
    Promise.all(
      Object.entries(flags)
        .filter(([, enabled]) => enabled)
        .map(async ([name]) => ({ name, module: await loaders[name]() }))
    ).then((loaded) => {
      panels = loaded;
    });
  }
</script>

{#if panels.length > 0}
  <div class="debug-panels-container">
    {#each panels as panel, index (panel.name)}
      <div class="debug-panel-wrapper" style="--panel-index: {index}">
        <svelte:component this={panel.module.default} />
      </div>
    {/each}
  </div>
{/if}

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
