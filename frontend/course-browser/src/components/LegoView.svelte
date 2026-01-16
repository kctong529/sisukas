<!-- src/components/LegoView.svelte -->
<script lang="ts">
  import { useSession } from '../lib/authClient';
  import { plansStore } from '../lib/stores/plansStore';
  import { SvelteSet } from 'svelte/reactivity';

  const session = useSession();
  $: isSignedIn = !!$session.data?.user;

  let expandedPlans = new SvelteSet<string>();

  function togglePlan(planId: string) {
    if (expandedPlans.has(planId)) {
      expandedPlans.delete(planId);
    } else {
      expandedPlans.add(planId);
    }
    expandedPlans = new SvelteSet(expandedPlans);
  }

  async function activatePlan(planId: string) {
    try {
      await plansStore.setActive(planId);
    } catch (err) {
      console.error('Failed to activate plan:', err);
    }
  }

  async function loadPlans() {
    try {
      await plansStore.load();
    } catch (err) {
      console.error('Failed to load plans:', err);
    }
  }
</script>

<div class="lego-view">
  {#if !isSignedIn}
    <div class="state-card">
      <div class="icon-circle">🔐</div>
      <h2>Sign in to view plans</h2>
      <p>You need to be logged in to see your course plans.</p>
    </div>

  {:else if $plansStore.loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading plans...</p>
    </div>

  {:else if $plansStore.error}
    <div class="state-card error">
      <h2>Something went wrong</h2>
      <p>{$plansStore.error}</p>
      <button on:click={loadPlans} class="btn btn-secondary">
        Try Again
      </button>
    </div>

  {:else if $plansStore.plans.length === 0}
    <div class="state-card">
      <div class="icon-circle">📋</div>
      <h2>No plans yet</h2>
      <p>Create your first plan from the Favourites view.</p>
    </div>

  {:else}
    <div class="header">
      <h1>Course Plans</h1>
      <p class="subtitle">{$plansStore.plans.length} plan{$plansStore.plans.length !== 1 ? 's' : ''}</p>
    </div>

    <div class="plans-container">
      {#each $plansStore.plans as plan (plan.id)}
        <div class="plan-card" class:active={plan.isActive}>
          <div class="plan-header" role="button" tabindex="0" on:click={() => togglePlan(plan.id)} on:keydown={(e) => e.key === 'Enter' && togglePlan(plan.id)}>
            <div class="plan-title">
              <h2>{plan.name}</h2>
              {#if plan.isActive}
                <span class="active-badge">ACTIVE</span>
              {/if}
            </div>
            <button 
              class="toggle-btn" 
              aria-label={expandedPlans.has(plan.id) ? 'Collapse plan' : 'Expand plan'}
              on:click={(e) => {
                e.stopPropagation();
                togglePlan(plan.id);
              }}
            >
              {expandedPlans.has(plan.id) ? '▼' : '▶'}
            </button>
          </div>

          {#if expandedPlans.has(plan.id)}
            <div class="plan-content">
              <div class="plan-meta">
                <div class="meta-item">
                  <span class="meta-label">Instances:</span>
                  <span class="meta-value">{plan.instanceIds.length}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Created:</span>
                  <span class="meta-value">{new Date(plan.createdAt).toLocaleDateString('fi-FI')}</span>
                </div>
              </div>

              {#if plan.instanceIds.length === 0}
                <div class="empty-state">
                  <p>No instances added yet</p>
                  <small>Add courses from your Favourites view</small>
                </div>
              {:else}
                <div class="instances-list">
                  <h3>Instances ({plan.instanceIds.length})</h3>
                  <div class="instance-tags">
                    {#each plan.instanceIds as instanceId (instanceId)}
                      <div class="instance-tag">{instanceId}</div>
                    {/each}
                  </div>
                </div>
              {/if}

              <div class="plan-actions">
                {#if !plan.isActive}
                  <button 
                    class="btn btn-activate" 
                    on:click={() => activatePlan(plan.id)}
                  >
                    Make Active
                  </button>
                {:else}
                  <span class="btn-active">✓ Active</span>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  :root {
    --primary: #4a90e2;
    --primary-hover: #2980f1;
    --bg: #f8fafc;
    --card-bg: #ffffff;
    --text-main: #1e293b;
    --text-muted: #64748b;
    --border: #e2e8f0;
    --success: #10b981;
  }

  .lego-view {
    max-width: 1400px;
    margin: 1.5rem auto;
    padding: 0 1rem;
    font-family: 'Inter', system-ui, sans-serif;
    color: var(--text-main);
  }

  .header {
    margin-bottom: 2rem;
  }

  h1 {
    font-size: 1.3rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
  }
  /* }
  h1 {
    font-size: 1.8rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
  } */

  .subtitle {
    font-size: 0.95rem;
    color: var(--text-muted);
    margin: 0;
  }

  h2 {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0;
  }

  h3 {
    font-size: 0.95rem;
    font-weight: 600;
    margin: 0 0 0.75rem 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }

  p {
    margin: 0;
  }

  .plans-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1rem;
  }

  .plan-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    transition: all 0.2s;
  }

  .plan-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  .plan-card.active {
    border-color: var(--success);
    background: #f0fdf4;
  }

  .plan-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    cursor: pointer;
    user-select: none;
    gap: 1rem;
  }

  .plan-header:hover {
    opacity: 0.95;
  }

  .plan-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;
  }

  .plan-title h2 {
    color: white;
    margin: 0;
    word-break: break-word;
  }

  .active-badge {
    display: inline-block;
    background: rgba(255, 255, 255, 0.3);
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    font-size: 0.65rem;
    font-weight: 700;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .toggle-btn {
    background: none;
    border: none;
    color: white;
    font-size: 1rem;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    transition: transform 0.2s;
  }

  .toggle-btn:hover {
    transform: scale(1.1);
  }

  .plan-content {
    padding: 1rem;
    border-top: 1px solid var(--border);
  }

  .plan-meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .meta-item {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem;
    background: var(--bg);
    border-radius: 6px;
    font-size: 0.85rem;
  }

  .meta-label {
    font-weight: 600;
    color: var(--text-muted);
  }

  .meta-value {
    color: var(--primary);
    font-weight: 600;
  }

  .empty-state {
    text-align: center;
    padding: 2rem 1rem;
    background: var(--bg);
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .empty-state p {
    font-size: 1rem;
    color: var(--text-main);
    margin-bottom: 0.25rem;
  }

  .empty-state small {
    color: var(--text-muted);
    display: block;
  }

  .instances-list {
    margin-bottom: 1rem;
  }

  .instance-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .instance-tag {
    background: linear-gradient(135deg, #dbeafe 0%, #e0f2fe 100%);
    color: #1e40af;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    word-break: break-all;
  }

  .plan-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn {
    padding: 0.6rem 1rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
    flex: 1;
  }

  .btn-activate {
    background: var(--primary);
    color: white;
  }

  .btn-activate:hover {
    background: var(--primary-hover);
  }

  .btn-activate:focus {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .btn-active {
    display: inline-block;
    padding: 0.6rem 1rem;
    background: var(--success);
    color: white;
    border-radius: 6px;
    font-weight: 600;
    font-size: 0.85rem;
    text-align: center;
    flex: 1;
  }

  .btn-secondary {
    background: var(--card-bg);
    color: var(--text-main);
    border: 1px solid var(--border);
    padding: 0.6rem 1.25rem;
  }

  .btn-secondary:hover {
    border-color: var(--primary);
    background: #f1f5f9;
  }

  .state-card {
    text-align: center;
    padding: 5rem 2rem;
    background: var(--card-bg);
    border-radius: 16px;
    border: 2px dashed var(--border);
  }

  .icon-circle {
    width: 80px;
    height: 80px;
    background: var(--bg);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    margin: 0 auto 1.5rem;
  }

  .state-card h2 {
    font-size: 1.4rem;
    margin-bottom: 0.5rem;
  }

  .state-card p {
    color: var(--text-muted);
    margin-bottom: 1.5rem;
  }

  .state-card.error {
    background: #fef2f2;
    border-color: #fecaca;
  }

  .state-card.error h2 {
    color: #ef4444;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem;
    text-align: center;
  }

  @media (max-width: 640px) {
    .plans-container {
      grid-template-columns: 1fr;
    }

    .plan-header {
      padding: 0.75rem;
    }

    .plan-content {
      padding: 0.75rem;
    }
  }
</style>