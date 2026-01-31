<!-- src/components/PlansStoreDebug.svelte -->
<script lang="ts">
  import { plansStore } from '../lib/stores/plansStore.svelte';

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
      console.error('Failed to load plans:', err);
    }
  }

  async function createTestPlan() {
    const name = prompt('Enter plan name:');
    if (!name) return;
    try {
      await plansStore.actions.create(name);
    } catch (err) {
      console.error('Failed to create plan:', err);
    }
  }

  async function setActivePlan(planId: string) {
    try {
      await plansStore.actions.setActive(planId);
    } catch (err) {
      console.error('Failed to set active plan:', err);
    }
  }

  async function addTestInstance(planId: string) {
    const instanceId = prompt('Enter instance ID (e.g., inst-001):');
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
      console.error('Failed to add instance:', err);
    }
  }
</script>

<div class="debug-panel" data-index="1">
  <button class="debug-toggle" onclick={togglePanel}>
    📋 Plans Store {isOpen ? '▼' : '▶'}
  </button>

  {#if isOpen}
    <div class="debug-content">
      <!-- Loading State -->
      <div class="section">
        <h4>Status</h4>
        <div class="status-grid">
          <div class="status-item">
            <span class="label">Loading:</span>
            <span class="value" class:true={loading}>
              {loading ? '⏳ Yes' : '✓ No'}
            </span>
          </div>
          <div class="status-item">
            <span class="label">Plans:</span>
            <span class="value">{plans.length}</span>
          </div>
          <div class="status-item">
            <span class="label">Active:</span>
            <span class="value" class:set={activePlan}>
              {activePlan ? activePlan.name : '—'}
            </span>
          </div>
        </div>
      </div>

      <!-- Active Plan Details -->
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

      <!-- All Plans List -->
      <div class="section">
        <h4>All Plans ({plans.length})</h4>
        <div class="list">
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
              <div class="plan-item-actions">
                {#if !plan.isActive}
                  <button
                    class="action-btn activate"
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

      <!-- Error State -->
      {#if error}
        <div class="section error">
          <h4>⚠️ Error</h4>
          <div class="error-message">{error}</div>
        </div>
      {/if}

      <!-- Action Buttons -->
      <div class="actions">
        <button class="action-btn primary" onclick={loadPlans}>
          Load Plans
        </button>
        <button class="action-btn primary" onclick={createTestPlan}>
          + Create Plan
        </button>
        <button class="action-btn danger" onclick={clearStore}>
          Clear Store
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .debug-panel {
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    font-family: monospace;
    font-size: 0.75rem;
    max-width: 420px;
    max-height: 620px;
  }

  .debug-toggle {
    width: 100%;
    padding: 0.75rem;
    background: #2c3e50;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: background 0.2s;
  }

  .debug-toggle:hover {
    background: #1a252f;
  }

  .debug-content {
    padding: 1rem;
    max-height: 570px;
    overflow-y: auto;
    border-top: 1px solid #ddd;
  }

  .section {
    margin-bottom: 1rem;
  }

  .section:last-of-type {
    margin-bottom: 0.75rem;
  }

  .section.error {
    background: #fee;
    padding: 0.5rem;
    border-radius: 4px;
  }

  .section.active-plan {
    background: #f0fdf4;
    border: 1px solid #86efac;
    padding: 0.75rem;
    border-radius: 4px;
  }

  h4 {
    margin: 0 0 0.5rem;
    color: #2c3e50;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Status Grid */
  .status-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }

  .status-item {
    display: flex;
    justify-content: space-between;
    background: #f8f9fa;
    padding: 0.4rem 0.5rem;
    border-radius: 3px;
    border: 1px solid #e9ecef;
  }

  .status-item .label {
    color: #495057;
    font-weight: 600;
  }

  .status-item .value {
    color: #0d6efd;
    font-weight: 600;
  }

  .status-item .value.true {
    color: #ffc107;
  }

  .status-item .value.set {
    color: #198754;
  }

  /* Plan Details */
  .plan-details {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 4px;
    overflow: hidden;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.4rem 0.5rem;
    border-bottom: 1px solid #e9ecef;
  }

  .detail-row:last-child {
    border-bottom: none;
  }

  .detail-row .label {
    color: #495057;
    font-weight: 600;
    flex-shrink: 0;
  }

  .detail-row .value {
    color: #0d6efd;
    word-break: break-all;
    text-align: right;
  }

  .detail-row .value.mono {
    font-family: 'Courier New', monospace;
    font-size: 0.7rem;
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

  /* Plans List */
  .list {
    background: #f8f9fa;
    border-radius: 4px;
    border: 1px solid #e9ecef;
    max-height: 150px;
    overflow-y: auto;
  }

  .plan-item {
    padding: 0.5rem;
    border-bottom: 1px solid #e9ecef;
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
    background: #198754;
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

  .plan-item-actions {
    display: flex;
    gap: 0.3rem;
  }

  .empty {
    color: #adb5bd;
    font-style: italic;
    padding: 0.5rem;
    text-align: center;
  }

  .error-message {
    color: #d9534f;
    padding: 0.5rem;
    word-break: break-word;
    background: white;
    border-radius: 3px;
  }

  /* Action Buttons */
  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem;
    margin-top: 0.75rem;
  }

  .action-btn {
    padding: 0.4rem 0.5rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.7rem;
    font-weight: 600;
    transition: all 0.2s;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .action-btn.primary {
    background: #0d6efd;
    color: white;
    grid-column: span 1;
  }

  .action-btn.primary:hover {
    background: #0b5ed7;
  }

  .action-btn.danger {
    background: #d9534f;
    color: white;
    grid-column: span 2;
  }

  .action-btn.danger:hover {
    background: #c82333;
  }

  .action-btn.activate {
    background: #198754;
    color: white;
    flex: 1;
    padding: 0.3rem 0.4rem;
    font-size: 0.65rem;
  }

  .action-btn.activate:hover {
    background: #157347;
  }

  .action-btn.add-instance {
    background: #0dcaf0;
    color: white;
    flex: 1;
    padding: 0.3rem 0.4rem;
    font-size: 0.65rem;
  }

  .action-btn.add-instance:hover {
    background: #0ba9cc;
  }
</style>
