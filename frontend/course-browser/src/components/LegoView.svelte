<!-- src/components/LegoView.svelte -->
<script lang="ts">
  import { useSession } from '../lib/authClient';
  import { plansStore } from '../lib/stores/plansStore';
  import { courseStore } from '../lib/stores/courseStore';
  import PlanManager from './PlanManager.svelte';
  import StudyGroupsGrid from './StudyGroupsGrid.svelte';
  import type { Course } from '../domain/models/Course';
  import BlocksSection from './BlocksSection.svelte';

  const session = useSession();
  let isSignedIn = $derived(!!$session.data?.user);

  // Derive active plan from store
  let activePlan = $derived.by(() => $plansStore.activePlan);

  async function loadPlans() {
    try {
      await plansStore.load();
    } catch (err) {
      console.error('Failed to load plans:', err);
    }
  }

  function getCourseForInstance(instanceId: string): Course | undefined {
    // Search through all courses to find the one matching this instance ID
    const allCourses = courseStore.getAll();
    for (const courseArray of allCourses.values()) {
      const course = courseArray.find(c => c.id === instanceId);
      if (course) return course;
    }
    return undefined;
  }

  const courseInstanceId = 'aalto-CUR-206050-3121830';
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
      <button onclick={loadPlans} class="btn btn-secondary">
        Try Again
      </button>
    </div>

  {:else if $plansStore.plans.length === 0}
    <div class="state-card">
      <div class="icon-circle">📋</div>
      <h2>No plans yet</h2>
      <p>Create your first plan from the Favourites view.</p>
    </div>

  {:else if !activePlan}
    <div class="state-card">
      <div class="icon-circle">📋</div>
      <h2>No active plan</h2>
      <p>Select a plan to view its instances.</p>
      <PlanManager compact={true} />
    </div>

  {:else}
    <div class="header-section">
      <div class="title-group">
        <h1>LEGO Composition (Not Done Yet)</h1>
      </div>
      
      <PlanManager compact={true} />
    </div>

    <div class="instances-container">
      {#if activePlan.instanceIds.length === 0}
        <div class="state-card">
          <div class="icon-circle">✨</div>
          <h2>No instances yet</h2>
          <p>Add course instances from your Favourites view to this plan.</p>
        </div>
      {:else}
        <div class="instances-list">
          {#each activePlan.instanceIds as instanceId (instanceId)}
            {@const course = getCourseForInstance(instanceId)}
            <div class="instance-card">
              <div class="instance-header">
                <div class="instance-info">
                  {#if course}
                    <h3 class="instance-id">{course.code || instanceId}</h3>
                    <p class="instance-name">{course.name?.en}</p>
                  {:else}
                    <h3 class="instance-id">{instanceId}</h3>
                  {/if}
                </div>
              </div>

              {#if course}
                <div class="instance-content">
                  <StudyGroupsGrid {course} isExpanded={true} />
                </div>
              {/if}
            </div>
          {/each}
        </div>
        <BlocksSection {courseInstanceId} courseInstanceName="CS-C2160" />
      {/if}
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

  .header-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .title-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  h1 {
    font-size: 1.3rem;
    font-weight: 600;
    margin: 0;
  }

  h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: var(--primary);
  }

  p {
    margin: 0;
  }

  .instances-container {
    display: flex;
    flex-direction: column;
  }

  .instances-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(224px, 0.5fr));
    gap: 0.3rem;
  }

  .instance-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .instance-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .instance-header {
    display: flex;
    align-items: center;
    padding: 0.7rem 0.7rem;
    padding-bottom: 0;
    background: var(--card-bg);
    color: var(--text-main);
  }

  .instance-info {
    flex: 1;
    min-width: 0;
  }

  .instance-id {
    color: var(--primary);
    margin: 0;
    font-size: 0.9rem;
    font-weight: 700;
    line-height: 1.1;
  }

  .instance-name {
    font-size: 0.75rem;
    color: #333;
    margin: 0.1rem 0 0 0;
    line-height: 1.2;
    word-break: break-word;
  }

  .instance-content {
    padding: 0.5rem 0.5rem;
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

  .btn {
    padding: 0.6rem 1rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
  }

  .btn-secondary {
    background: var(--card-bg);
    color: var(--text-main);
    border: 1px solid var(--border);
  }

  .btn-secondary:hover {
    border-color: var(--primary);
    background: #f1f5f9;
  }

  @media (max-width: 484px) {
    .instances-list {
      grid-template-columns: 1fr;
    }
  }
</style>