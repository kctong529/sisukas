<!-- src/components/PlansStoreDebug.svelte -->
<script lang="ts">
  import { plansStore } from "../../lib/stores/plansStore.svelte";

  let isOpen = $state(false);

  const plans = $derived.by(() => plansStore.read.getAll());
  const activePlan = $derived.by(() => plansStore.read.getActive());
  const loading = $derived.by(() => plansStore.state.loading);
  const error = $derived.by(() => plansStore.state.error);

  function togglePanel() {
    isOpen = !isOpen;
  }

  function clearStore() {
    plansStore.actions.clear();
  }

  async function loadPlans() {
    try {
      await plansStore.actions.ensureLoaded();
    } catch (err) {
      console.error("Failed to load plans:", err);
    }
  }

  async function createTestPlan() {
    const name = prompt("Enter plan name:");
    if (!name) return;
    try {
      await plansStore.actions.create(name);
    } catch (err) {
      console.error("Failed to create plan:", err);
    }
  }

  async function setActivePlan(planId: string) {
    try {
      await plansStore.actions.setActive(planId);
    } catch (err) {
      console.error("Failed to set active plan:", err);
    }
  }

  async function addTestInstance(planId: string) {
    const instanceId = prompt("Enter instance ID (e.g., inst-001):");
    if (!instanceId) return;

    try {
      // Temporarily activate the plan to add instance
      const originalActiveId = activePlan?.id;
      await plansStore.actions.setActive(planId);
      await plansStore.actions.addInstanceToActivePlan(instanceId);

      if (originalActiveId && originalActiveId !== planId) {
        await plansStore.actions.setActive(originalActiveId);
      }
    } catch (err) {
      console.error("Failed to add instance:", err);
    }
  }
</script>

<div class="debug-panel" data-index="1">
  <button class="debug-toggle" onclick={togglePanel}>
    📋 Plans Store {isOpen ? "▼" : "▶"}
  </button>

  {#if isOpen}
    <div class="debug-content">
      <div class="section">
        <h4>Status</h4>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="label">Loading:</span>
            <span class="value" class:active={loading}>
              {loading ? "⏳ Yes" : "✓ No"}
            </span>
          </div>

          <div class="stat-item">
            <span class="label">Plans:</span>
            <span class="value">{plans.length}</span>
          </div>

          <div class="stat-item">
            <span class="label">Active:</span>
            <span class="value" class:ok={!!activePlan} class:warn={!activePlan}>
              {activePlan ? activePlan.name : "—"}
            </span>
          </div>
        </div>
      </div>

      {#if activePlan}
        <div class="section active-plan">
          <h4>📌 Active Plan</h4>

          <div class="plan-details">
            <div class="detail-row">
              <span class="label">Name:</span>
              <span class="value">{activePlan.name}</span>
            </div>

            <div class="detail-row">
              <span class="label">ID:</span>
              <span class="value mono">{activePlan.id}</span>
            </div>

            <div class="detail-row">
              <span class="label">Instances:</span>
              <span class="value">{activePlan.instanceIds.length}</span>
            </div>

            {#if activePlan.instanceIds.length > 0}
              <div class="instances-list">
                {#each activePlan.instanceIds as instId (instId)}
                  <div class="instance-tag">{instId}</div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <div class="section">
        <h4>All Plans ({plans.length})</h4>

        <div class="list" style="--dbg-list-max-height: 150px;">
          {#each plans as plan (plan.id)}
            <div class="plan-item" class:active={plan.isActive}>
              <div class="plan-item-header">
                <span class="plan-name">{plan.name}</span>
                {#if plan.isActive}
                  <span class="badge">ACTIVE</span>
                {/if}
              </div>

              <div class="plan-item-meta">
                <span class="meta">{plan.instanceIds.length} instances</span>
              </div>

              <div class="btn-row plan-item-actions">
                {#if !plan.isActive}
                  <button
                    class="action-btn success"
                    onclick={() => setActivePlan(plan.id)}
                    title="Make this plan active"
                  >
                    Activate
                  </button>
                {/if}

                <button
                  class="action-btn add-instance"
                  onclick={() => addTestInstance(plan.id)}
                  title="Add test instance"
                >
                  + Instance
                </button>
              </div>
            </div>
          {/each}

          {#if plans.length === 0}
            <div class="empty">No plans loaded</div>
          {/if}
        </div>
      </div>

      {#if error}
        <div class="section error">
          <h4>⚠️ Error</h4>
          <div class="error-message">{error}</div>
        </div>
      {/if}

      <div class="actions">
        <button class="action-btn primary" onclick={loadPlans}>Load Plans</button>
        <button class="action-btn primary" onclick={createTestPlan}>+ Create Plan</button>
        <button class="action-btn danger" onclick={clearStore}>Clear Store</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .debug-panel {
    --dbg-max-width: 420px;
    --dbg-max-height: 620px;
    --dbg-content-max-height: 570px;
  }

  /* Component-specific layout */
  .active-plan {
    background: #f0fdf4;
    border: 1px solid #86efac;
    padding: 0.75rem;
    border-radius: 4px;
  }

  .plan-details {
    background: var(--dbg-muted-bg);
    border: 1px solid var(--dbg-muted-border);
    border-radius: 4px;
    overflow: hidden;
  }

  .instances-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    padding: 0.5rem;
    background: white;
  }

  .instance-tag {
    background: #dbeafe;
    color: #1e40af;
    padding: 0.2rem 0.4rem;
    border-radius: 3px;
    font-size: 0.65rem;
    font-weight: 600;
  }

  .plan-item {
    padding: 0.5rem;
    border-bottom: 1px solid var(--dbg-muted-border);
    background: white;
  }
  .plan-item:last-child {
    border-bottom: none;
  }
  .plan-item.active {
    background: #f0fdf4;
  }

  .plan-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.3rem;
  }

  .plan-name {
    color: #2c3e50;
    font-weight: 600;
    flex: 1;
    word-break: break-word;
  }

  .badge {
    background: var(--dbg-green);
    color: white;
    padding: 0.15rem 0.3rem;
    border-radius: 2px;
    font-size: 0.6rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .plan-item-meta {
    color: #6c757d;
    font-size: 0.65rem;
    margin-bottom: 0.3rem;
  }

  .meta {
    display: inline-block;
    background: #e9ecef;
    padding: 0.15rem 0.3rem;
    border-radius: 2px;
  }

  /* Local-only cyan variant for add button */
  .add-instance {
    background: #0dcaf0;
    color: white;
  }
  .add-instance:hover:not(:disabled) {
    background: #0ba9cc;
  }

  /* Keep the "3 buttons" layout */
  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem;
    margin-top: 0.75rem;
  }
  .actions .action-btn.danger {
    grid-column: span 2;
  }
</style>
