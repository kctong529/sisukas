<!-- src/components/PlanManager.svelte -->
<script lang="ts">
  import { plansStore } from '../lib/stores/plansStore';
  import type { Plan } from '../domain/models/Plan';

  interface PlanManagerProps {
    onPlanSelect?: (plan: Plan) => void;
    showCreateButton?: boolean;
    compact?: boolean;
  }

  const {
    onPlanSelect = () => {},
    showCreateButton = true,
    compact = false,
  }: PlanManagerProps = $props();

  let plans = $state<Plan[]>([]);
  let activePlan = $state<Plan | null>(null);
  let loading = $state(false);
  let isCreating = $state(false);
  let newPlanName = $state('');

  // Subscribe to store
  const unsubscribe = plansStore.subscribe((state) => {
    plans = state.plans;
    activePlan = state.activePlan;
    loading = state.loading;
  });

  $effect(() => {
    return () => unsubscribe();
  });

  async function handleSelectPlan(plan: Plan) {
    try {
      await plansStore.setActive(plan.id);
      onPlanSelect(plan);
    } catch (err) {
      console.error('Failed to select plan:', err);
    }
  }

  async function handleCreatePlan() {
    if (!newPlanName.trim()) return;
    try {
      const created = await plansStore.create(newPlanName);
      await plansStore.setActive(created.id);
      onPlanSelect(created);
      newPlanName = '';
      isCreating = false;
    } catch (err) {
      console.error('Failed to create plan:', err);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleCreatePlan();
    if (e.key === 'Escape') {
      isCreating = false;
      newPlanName = '';
    }
  }
</script>

<div class="plan-manager" class:compact>
  {#if compact}
    <!-- Compact mode: dropdown-like selector -->
    <div class="compact-header">
      <label for="plan">Active plan:</label>
      <select
        value={activePlan?.id || ''}
        onchange={(e) => {
          const plan = plans.find((p) => p.id === e.currentTarget.value);
          if (plan) handleSelectPlan(plan);
        }}
        disabled={loading}
        class="plan-select"
      >
        <option value="">Select a plan...</option>
        {#each plans as plan (plan.id)}
          <option value={plan.id}>{plan.name}</option>
        {/each}
      </select>
      {#if showCreateButton}
        {#if isCreating}
          <input
            type="text"
            placeholder="Plan name..."
            bind:value={newPlanName}
            onkeydown={handleKeydown}
            class="plan-input compact-input"
          />
          <button class="btn btn-primary btn-small" onclick={handleCreatePlan} disabled={!newPlanName.trim()}>
            ◯
          </button>
          <button class="btn btn-primary-cancel btn-small" onclick={() => (isCreating = false)}>
            ✕
          </button>
        {:else}
          <button
            class="icon-button"
            onclick={() => (isCreating = true)}
            disabled={loading}
            title="Create new plan"
          >
            ＋
          </button>
        {/if}
      {/if}
    </div>
  {:else}
    <!-- Full mode: list with selection -->
    <div class="plan-list">
      {#each plans as plan (plan.id)}
        <button
          class="plan-item"
          class:active={plan.id === activePlan?.id}
          onclick={() => handleSelectPlan(plan)}
          disabled={loading}
        >
          <span class="plan-item-name">{plan.name}</span>
          <span class="plan-item-meta">{plan.instanceIds.length}</span>
        </button>
      {/each}
      {#if plans.length === 0}
        <div class="empty">No plans yet</div>
      {/if}
    </div>

    {#if showCreateButton}
      <div class="action-bar">
        {#if isCreating}
          <div class="create-form">
            <input
              type="text"
              placeholder="Plan name..."
              bind:value={newPlanName}
              onkeydown={handleKeydown}
              class="plan-input"
            />
            <button class="btn btn-primary" onclick={handleCreatePlan} disabled={!newPlanName.trim()}>
              Create
            </button>
            <button class="btn btn-secondary" onclick={() => (isCreating = false)}> Cancel </button>
          </div>
        {:else}
          <button class="btn btn-secondary" onclick={() => (isCreating = true)}> + New Plan </button>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .plan-manager {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .plan-manager.compact {
    flex-direction: row;
    align-items: center;
    gap: 0.3rem;
  }

  /* Full mode */
  .plan-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    overflow: hidden;
    background: white;
  }

  .plan-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border: none;
    background: white;
    border-bottom: 1px solid #f0f0f0;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .plan-item:last-child {
    border-bottom: none;
  }

  .plan-item:hover:not(:disabled) {
    background: #fafafa;
  }

  .plan-item.active {
    background: #e3f2fd;
    border-left: 3px solid #2196f3;
    padding-left: calc(1rem - 3px);
  }

  .plan-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .plan-item-name {
    font-weight: 500;
    flex: 1;
  }

  .plan-item-meta {
    font-size: 0.85rem;
    color: #999;
    margin-left: 0.75rem;
  }

  .empty {
    padding: 1rem;
    text-align: center;
    color: #999;
    font-size: 0.9rem;
  }

  .action-bar {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .create-form {
    display: flex;
    gap: 0.5rem;
  }

  .plan-input {
    flex: 1;
    padding: 0.5rem 0.8rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.9rem;
    background: #ffffff;
    color: #1e293b;
  }

  .plan-input:focus {
    outline: none;
    border-color: #4a90e2;
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
  }

  /* Compact mode */
  .compact-header {
    display: flex;
    gap: 0.3rem;
    align-items: center;
    height: 32.5px;
    font-size: 0.8rem;
  }

  label {
    white-space: nowrap;
    font-weight: 500;
  }

  .compact-input {
    flex: 1;
    padding: 0.5rem 0.8rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8rem;
    background: #ffffff;
    color: #1e293b;
  }

  .compact-input:focus {
    outline: none;
    border-color: #4a90e2;
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
  }

  .plan-select {
    flex: 1;
    padding: 0.5rem 0.8rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8rem;
    cursor: pointer;
    background: #ffffff;
    color: #1e293b;
    appearance: none;
    height: 32.5px;
  }

  .plan-select:hover {
    border-color: #4a90e2;
  }

  .plan-select:focus {
    outline: none;
    border-color: #4a90e2;
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
  }

  /* Buttons */
  .btn {
    padding: 0.5rem 0.8rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 500;
    transition: all 0.2s;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #4a90e2;
    color: white;
    height: 32.5px;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2980f1;
  }

  .btn-primary:focus:not(:disabled) {
    outline: 2px solid #4a90e2;
    outline-offset: 2px;
  }

  .btn-primary-cancel {
    background: #ffffff;
    color: #1e293b;
    border: 1px solid #e2e8f0;
    height: 32.5px;
  }

  .btn-primary-cancel:hover:not(:disabled) {
    border-color: #4a90e2;
    background: #f8fafc;
  }

  .btn-primary-cancel:focus:not(:disabled) {
    outline: none;
    border-color: #4a90e2;
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
  }

  .btn-secondary {
    background: #ffffff;
    color: #1e293b;
    border: 1px solid #e2e8f0;
    margin-bottom: 12px;
  }

  .btn-secondary:hover:not(:disabled) {
    border-color: #4a90e2;
    background: #f8fafc;
  }

  .btn-secondary:focus:not(:disabled) {
    outline: none;
    border-color: #4a90e2;
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
  }

  .btn-small {
    padding: 0.4rem 0.6rem;
    font-size: 0.8rem;
  }

  .icon-button {
    padding: 0.2rem 0;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: #ffffff;
    color: #1e293b;
    cursor: pointer;
    font-size: 0.8rem;
    transition: all 0.2s;
    min-width: 30px;
    height: 32.5px;
    text-align: center;
  }

  .icon-button:hover:not(:disabled) {
    border-color: #4a90e2;
    background: #f8fafc;
  }

  .icon-button:focus:not(:disabled) {
    outline: none;
    border-color: #4a90e2;
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
  }

  .icon-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>