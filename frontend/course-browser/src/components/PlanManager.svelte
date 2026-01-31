<!-- src/components/PlanManager.svelte -->
<script lang="ts">
  import { plansStore } from '../lib/stores/plansStore.svelte';
  import { NotificationService } from '../infrastructure/services/NotificationService';

  interface PlanManagerProps {
    onPlanSelect?: (planId: string) => void;
    showCreateButton?: boolean;
    compact?: boolean;
  }

  const {
    onPlanSelect = () => {},
    showCreateButton = true,
    compact = false,
  }: PlanManagerProps = $props();

  let isCreating = $state(false);
  let newPlanName = $state('');

  const plans = $derived.by(() => plansStore.read.getAll());
  const activePlan = $derived.by(() => plansStore.read.getActive());
  const loading = $derived.by(() => plansStore.state.loading);

  let compactInput = $state<HTMLInputElement | null>(null);
  let fullInput = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (!isCreating) return;

    const el = compact ? compactInput : fullInput;
    el?.focus();
    el?.select();
  });

  function closeCreate() {
    isCreating = false;
    newPlanName = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleCreatePlan();
    if (e.key === 'Escape') closeCreate();
  }

  async function handleCreatePlan() {
    if (!newPlanName.trim()) return;
    try {
      const created = await plansStore.actions.create(newPlanName);
      await plansStore.actions.setActive(created.id);
      onPlanSelect(created.id);
      NotificationService.success(`Plan "${newPlanName}" created`);
      closeCreate();
    } catch (err) {
      NotificationService.error(
        err instanceof Error ? err.message : 'Failed to create plan'
      );
    }
  }

  async function handleSelectPlan(planId: string) {
    try {
      await plansStore.actions.setActive(planId);
      onPlanSelect(planId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to select plan';
      NotificationService.error(message);
    }
  }
</script>

<div class="plan-manager" class:compact>
  {#if compact}
    <!-- Compact mode: dropdown-like selector -->
    <div class="compact-header" class:creating={isCreating}>
      <label for="plan">Active plan:</label>
      <select
        value={activePlan?.id || ''}
        onchange={(e) => {
          const planId = e.currentTarget.value;
          if (planId) handleSelectPlan(planId);
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
            bind:this={compactInput}
            type="text"
            placeholder="Plan name..."
            bind:value={newPlanName}
            onkeydown={handleKeydown}
            class="plan-input"
          />
          <button class="btn btn-primary btn-small" onclick={handleCreatePlan} disabled={!newPlanName.trim()}>
            ◯
          </button>
          <button class="btn btn-secondary btn-small" onclick={() => (isCreating = false)}>
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
          onclick={() => handleSelectPlan(plan.id)}
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
              bind:this={fullInput}
              type="text"
              placeholder="Plan name..."
              bind:value={newPlanName}
              onkeydown={handleKeydown}
              class="plan-input"
            />
            <button class="btn btn-primary" onclick={handleCreatePlan} disabled={!newPlanName.trim()}>
              ◯
            </button>
            <button class="btn btn-secondary" onclick={() => (isCreating = false)}>
              ✕
            </button>
          </div>
        {:else}
          <button class="btn btn-secondary btn-expand" onclick={() => (isCreating = true)}> + New Plan </button>
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
    min-width: 0;
  }

  .plan-manager.compact {
    flex-direction: row;
    align-items: center;
    gap: 0.3rem;
    height: 32.5px;
    min-width: 0;
    overflow: hidden;
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
    gap: 0.3rem;
    height: 32.5px;
  }

  /* Standardized input field */
  .plan-input {
    flex: 1;
    padding: 0.5rem 0.8rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8rem;
    color: #1e293b;
    background: #ffffff;
    box-sizing: border-box;
    height: 32.5px;
  }

  @media (max-width: 480px) {
    .plan-input {
      flex: 0 0 auto;
    }
  }

  .plan-input:focus {
    outline: none;
    border-color: #4a90e2;
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
  }

  .plan-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
    width: 95px;
    box-sizing: border-box;
  }

  @media (max-width: 480px) {
    .plan-select {
      flex: 0 0 auto;
    }
  }

  .plan-select:hover {
    border-color: #4a90e2;
  }

  .plan-select:focus {
    outline: none;
    border-color: #4a90e2;
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
  }

  .plan-select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Buttons */
  .btn {
    padding: 0.4rem 0.6rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 500;
    transition: all 0.2s;
    height: 32.5px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-small {
    width: 32.5px;
    height: 32.5px;
    padding: 0;
    min-width: 32.5px;
  }

  .btn-expand {
    width: 100%;
  }

  .btn-primary {
    background: #4a90e2;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2980f1;
  }

  .btn-primary:focus:not(:disabled) {
    outline: 2px solid #4a90e2;
    outline-offset: 2px;
  }

  .btn-secondary {
    background: #ffffff;
    color: #1e293b;
    border: 1px solid #e2e8f0;
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

  .icon-button {
    width: 32.5px;
    height: 32.5px;
    padding: 0;
    min-width: 32.5px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: #ffffff;
    color: #1e293b;
    cursor: pointer;
    font-size: 0.8rem;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
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

  @media (max-width: 460px) {
    .compact-header.creating .plan-select,
    .compact-header.creating label {
      display: none;
    }

    .compact-header.creating .plan-input {
      flex: 1;
      min-width: 60px;
    }

    .compact-header.creating .btn-small {
      flex-shrink: 0;
    }
  }

  @media (max-width: 420px) {
    .plan-input {
      flex: 1 1 60px;
      min-width: 60px;
    }
  }
</style>
