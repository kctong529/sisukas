<!-- src/components/PlanEditor.svelte -->
<script lang="ts">
  import { plansStore } from '../lib/stores/plansStore.svelte';
  import { NotificationService } from '../infrastructure/services/NotificationService';
  import type { Plan } from '../domain/models/Plan';

  interface PlanEditorProps {
    plan: Plan | null;
    onRemoved?: () => void;
  }

  const { plan, onRemoved = () => {} }: PlanEditorProps = $props();

  // element refs + focus bookkeeping as $state
  let inputEl = $state<HTMLInputElement | null>(null);
  let dialogEl = $state<HTMLDialogElement | null>(null);
  let removeBtnEl = $state<HTMLButtonElement | null>(null);
  let previouslyFocused = $state<HTMLElement | null>(null);

  let isEditing = $state(false);
  let editingName = $state(plan?.name);
  let isRemoving = $state(false);
  let isSaving = $state(false);

  function startEditing() {
    isEditing = true;
    editingName = plan?.name;
  }

  function cancelEditing() {
    isEditing = false;
    editingName = plan?.name;
  }

  async function savePlanName() {
    if (!plan) return;

    if (!editingName?.trim()) {
      NotificationService.error('Plan name cannot be empty');
      return;
    }

    if (editingName === plan.name) {
      isEditing = false;
      return;
    }

    isSaving = true;
    try {
      await plansStore.actions.updatePlanName(plan.id, editingName.trim());
      NotificationService.success('Plan updated');
      isEditing = false;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update plan';
      NotificationService.error(message);
      editingName = plan.name;
    } finally {
      isSaving = false;
    }
  }

  async function confirmRemove() {
    if (!plan) return;
    try {
      await plansStore.actions.removePlan(plan.id);
      NotificationService.success(`Plan "${plan.name}" removed`);
      isRemoving = false;
      onRemoved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove plan';
      NotificationService.error(message);
    }
  }

  function cancelRemove() {
    isRemoving = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      savePlanName();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancelEditing();
    }
  }

  function trapFocus(e: KeyboardEvent) {
    if (e.key !== 'Tab' || !dialogEl) return;

    const focusables = dialogEl.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // Focus the input when entering edit mode (no tick, no autofocus)
  $effect(() => {
    if (!isEditing) return;
    if (!inputEl) return;

    inputEl.focus();
    inputEl.select();
  });

  // Save previously focused element when dialog opens
  $effect(() => {
    if (!isRemoving) return;
    previouslyFocused = document.activeElement as HTMLElement | null;
  });

  // Focus the destructive action when dialog opens (optional, but replaces autofocus)
  $effect(() => {
    if (!isRemoving) return;
    if (!removeBtnEl) return;

    removeBtnEl.focus();
  });

  // Restore focus when dialog closes OR component unmounts
  $effect(() => {
    if (isRemoving) return;

    // when it transitions from true -> false (or when component is destroyed),
    // this effect will re-run and restore focus if we have it.
    previouslyFocused?.focus();
    previouslyFocused = null;
  });
</script>

<div class="plan-editor">
  {#if !plan}
    <div class="empty-state">No active plan</div>

  {:else if isEditing}
    <div class="edit-form">
      <input
        type="text"
        bind:this={inputEl}
        bind:value={editingName}
        onkeydown={handleKeydown}
        placeholder="Plan name..."
        class="plan-input"
        disabled={isSaving}
      />

      <div class="edit-actions">
        <button
          type="button"
          class="btn btn-primary btn-small"
          onclick={savePlanName}
          disabled={isSaving || !editingName?.trim()}
          title="Save plan"
        >
          {isSaving ? '…' : '◯'}
        </button>

        <button
          type="button"
          class="btn btn-secondary btn-small"
          onclick={cancelEditing}
          disabled={isSaving}
          title="Cancel editing"
        >
          ✕
        </button>
      </div>
    </div>

  {:else}
    <div class="plan-display">
      <span class="plan-count">{plan.instanceIds?.length ?? 0} courses</span>

      <button
        type="button"
        class="icon-btn edit-btn"
        onclick={startEditing}
        aria-label="Edit plan"
      >
        ✎
      </button>

      <button
        type="button"
        class="icon-btn remove-btn"
        onclick={() => (isRemoving = true)}
        aria-label="Remove plan"
      >
        <i class="bi bi-trash" aria-hidden="true"></i>
      </button>
    </div>
  {/if}
</div>

{#if isRemoving && plan}
  <dialog
    bind:this={dialogEl}
    class="modal-overlay"
    open
    aria-labelledby="remove-plan-title"
    aria-describedby="remove-plan-desc"
    onkeydown={trapFocus}
    oncancel={(e) => {
      e.preventDefault();
      cancelRemove();
    }}
    onclick={(e) => {
      if (e.target === e.currentTarget) cancelRemove();
    }}
  >
    <div class="removal-confirmation">
      <div class="confirmation-content">
        <h3 id="remove-plan-title">Remove plan?</h3>

        <p id="remove-plan-desc">
          Are you sure you want to remove "<strong>{plan.name}</strong>"?
        </p>

        {#if plan.instanceIds && plan.instanceIds.length > 0}
          <p class="warning">
            This plan contains {plan.instanceIds.length} course{plan.instanceIds.length === 1 ? '' : 's'}.
            The courses will not be removed from Favourites, only the plan.
          </p>
        {/if}
      </div>

      <div class="confirmation-actions">
        <button
          bind:this={removeBtnEl}
          type="button"
          class="btn btn-danger btn-modal"
          onclick={confirmRemove}
        >
          Remove
        </button>

        <button
          type="button"
          class="btn btn-secondary btn-modal"
          onclick={cancelRemove}
        >
          Cancel
        </button>
      </div>
    </div>
  </dialog>
{/if}

<style>
  .plan-editor {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.8rem;
    height: 32.5px;
  }

  .empty-state {
    color: #64748b;
    padding: 0.5rem 0;
  }

  .plan-display {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    height: 32.5px;
  }

  .plan-count {
    color: #1e293b;
    padding: 0.2rem 0.4rem;
    border-radius: 3px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .icon-btn {
    padding: 0.35rem 0.4rem;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 32.5px;
    height: 32.5px;
    flex-shrink: 0;
  }

  .icon-btn:hover:not(:disabled) {
    border-color: #4a90e2;
    background: #f1f5f9;
  }

  .icon-btn:focus:not(:disabled) {
    outline: none;
    border-color: #4a90e2;
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
  }

  .icon-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .edit-btn:hover:not(:disabled) {
    color: #4a90e2;
  }

  .remove-btn {
    color: #d9534f;
  }

  .remove-btn:hover:not(:disabled) {
    background-color: #d9534f;
    color: white;
    border-color: white;
  }

  /* Edit form state - matches compact mode layout */
  .edit-form {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.3rem;
    height: 32.5px;
  }

  .plan-input {
    flex: 1;
    padding: 0.5rem 0.8rem;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    box-sizing: border-box;
    font-size: 0.8rem;
    color: #1e293b;
    background: #ffffff;
    height: 32.5px;
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

  .edit-actions {
    display: flex;
    gap: 0.3rem;
    flex-shrink: 0;
  }

  /* Removal confirmation state */
  .removal-confirmation {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
  }

  .confirmation-content {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .confirmation-content h3 {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: #991b1b;
  }

  .confirmation-content p {
    margin: 0;
    color: #7c2d12;
    font-size: 0.85rem;
    line-height: 1.4;
  }

  .confirmation-content p.warning {
    color: #b45309;
    background: #fef3c7;
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
  }

  .confirmation-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-modal {
    flex: 1;
    padding: 0.5rem;
  }

  /* Modal overlay */
  .modal-overlay {
    border: none;
    padding: 0;
    background: transparent;
  }

  .modal-overlay::backdrop {
    background: rgba(0, 0, 0, 0.5);
    animation: fadeIn 0.2s ease-out;
  }

  .modal-overlay[open] {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .removal-confirmation {
    max-width: 400px;
    width: 90%;
    animation: slideUp 0.2s ease-out;
  }

  /* Buttons */
  .btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s;
    height: 32.5px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    box-sizing: border-box;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-small {
    padding: 0;
    width: 32.5px;
    height: 32.5px;
    font-size: 0.8rem;
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

  .btn-danger {
    background: #ef4444;
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    background: #dc2626;
  }

  .btn-danger:focus:not(:disabled) {
    outline: 2px solid #ef4444;
    outline-offset: 2px;
  }
</style>
