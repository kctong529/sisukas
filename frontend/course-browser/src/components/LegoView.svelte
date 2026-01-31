<!-- src/components/LegoView.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import { useSession } from "../lib/authClient";
  import { courseIndexStore } from "../lib/stores/courseIndexStore.svelte";
  import { plansStore } from "../lib/stores/plansStore.svelte";
  import { blockStore } from "../lib/stores/blockStore";
  import { studyGroupStore } from "../lib/stores/studyGroupStore";

  import PlanManager from "./PlanManager.svelte";
  import BlocksGrid from "./BlocksGrid.svelte";
  import AnalyticsResults from "./AnalyticsResults.svelte";

  import type { Course } from "../domain/models/Course";
  import { buildAnalyticsPayload } from "../lib/analytics/buildAnalyticsPayload";
  import { fetchTopKSchedulePairs } from "../infrastructure/services/AnalyticsService";
  import type { AnalyticsResponse } from "../lib/types/analytics";
  import { normalizeComputeSchedulePairsResponse } from "../lib/analytics/normalizeComputeSchedulePairs";

  // ---- Session (runes) ----
  const session = useSession();
  const user = $derived.by(() => $session.data?.user);
  const isSignedIn = $derived.by(() => !!user);

  // ---- Local UI state ----
  const ui = $state({
    analyticsResp: null as AnalyticsResponse | null,
    analyticsError: null as string | null,
    running: false,
    showAnalyticsModal: false,
    plansLoading: false,
    plansError: null as string | null,
  });

  const activePlan = $derived.by(() => plansStore.read.getActive());
  const plans = $derived.by(() => plansStore.read.getAll());

  const resolveCourse = (instanceId: string): Course | undefined =>
    courseIndexStore.read.resolveByInstanceId(instanceId);

  async function loadPlans() {
    try {
      ui.plansLoading = true;
      ui.plansError = null;
      await plansStore.actions.ensureLoaded();
    } catch (err) {
      ui.plansError = err instanceof Error ? err.message : "Failed to load plans";
      console.error("Failed to load plans:", err);
    } finally {
      ui.plansLoading = false;
    }
  }

  function closeAnalyticsModal() {
    ui.showAnalyticsModal = false;
    ui.analyticsResp = null;
    ui.analyticsError = null;
  }

  async function showAnalysis() {
    const plan = activePlan;
    if (!plan) return;
    if (ui.running) return;

    ui.running = true;
    ui.analyticsError = null;
    ui.showAnalyticsModal = true;

    try {
      const payload = buildAnalyticsPayload({
        instanceIds: plan.instanceIds,
        getCourseForInstance: resolveCourse,
        getBlocksForInstance: (id) => blockStore.getCachedForInstance(id) ?? [],
        getStudyGroupsForInstance: (unitId, offeringId) => studyGroupStore.getCached(unitId, offeringId),
        topK: 20,
        scoreMode: "minMaxConcurrentThenOverlap"
      });

      const raw = await fetchTopKSchedulePairs(payload);
      ui.analyticsResp = normalizeComputeSchedulePairsResponse(raw);
    } catch (e) {
      ui.analyticsError = e instanceof Error ? e.message : String(e);
    } finally {
      ui.running = false;
    }
  }

  onMount(() => {
    // Load plans on mount
    if (isSignedIn) {
      void loadPlans();
      void courseIndexStore.actions.ensureHistoricalLoaded();
    }

    const onKeydown = (e: KeyboardEvent) => {
      if (!ui.showAnalyticsModal) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeAnalyticsModal();
      }
    };

    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  });
</script>

<div class="lego-view">
  {#if !isSignedIn}
    <div class="state-card">
      <div class="icon-circle">🔐</div>
      <h2>Sign in to view plans</h2>
      <p>You need to be logged in to see your course plans.</p>
    </div>

  {:else if ui.plansLoading || plansStore.state.loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading plans...</p>
    </div>

  {:else if ui.plansError || plansStore.state.error}
    <div class="state-card error">
      <h2>Something went wrong</h2>
      <p>{ui.plansError || plansStore.state.error}</p>
      <button onclick={loadPlans} class="btn btn-secondary">Try Again</button>
    </div>

  {:else if plans.length === 0}
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
        <h2>LEGO Composition</h2>
        {#if courseIndexStore.state.historicalLoading}
          <p class="muted">Loading historical courses...</p>
        {/if}
      </div>

      <button class="btn btn-analytics" onclick={showAnalysis} disabled={ui.running}>
        {ui.running ? "Running..." : "Compute Schedules"}
      </button>

      <PlanManager compact={true} />

      {#if ui.analyticsError && !ui.showAnalyticsModal}
        <div class="alert alert-error mt-2">{ui.analyticsError}</div>
      {/if}
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
            {@const course = resolveCourse(instanceId)}
            <div class="instance-card">
              <div class="instance-header">
                <div class="instance-info">
                  {#if course}
                    <h3 class="instance-id">{course.code?.value ?? instanceId}</h3>
                    <p class="instance-name">{course.name?.en}</p>
                  {:else}
                    <h3 class="instance-id">{instanceId}</h3>
                    {#if courseIndexStore.state.historicalLoading}
                      <p class="instance-name muted">Loading course...</p>
                    {/if}
                  {/if}
                </div>
              </div>

              {#if course}
                <div class="instance-content">
                  <BlocksGrid {course} />
                </div>
              {:else if courseIndexStore.state.historicalLoading}
                <div class="instance-content">
                  <p class="muted">Waiting for historical data...</p>
                </div>
              {:else}
                <div class="instance-content">
                  <p class="muted">Course data not found for this instance.</p>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

{#if ui.showAnalyticsModal}
  <div class="modal-backdrop" role="presentation">
    <button
      type="button"
      class="modal-overlay-close"
      aria-label="Close analytics modal"
      onclick={closeAnalyticsModal}
    ></button>

    <div class="modal-content" role="dialog" aria-modal="true" aria-label="Analytics results">
      <div class="modal-header">
        <div class="modal-title">Compute Schedules</div>

        <button type="button" class="modal-close" aria-label="Close" onclick={closeAnalyticsModal}>
          ✕
        </button>
      </div>

      <div class="modal-body">
        {#if ui.running}
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Computing best schedules...</p>
          </div>
        {:else if ui.analyticsError}
          <div class="alert alert-error">
            <h3>Error</h3>
            <p>{ui.analyticsError}</p>
          </div>
        {:else}
          <div class="analytics-intro">
            <p><strong>Schedule Optimizer</strong></p>
            <p>
              This tool explores all possible combinations of study groups across your selected courses 
              and ranks them by conflict density, longest day, and lunch availability.
            </p>
            <details class="tech-details">
              <summary>How it works</summary>
              <ul>
                <li>Enumerates all valid study group combinations (capped at 100,000 to avoid exponential explosion)</li>
                <li>Scores each candidate based on hard constraints: minimizes overlapping events and long consecutive days</li>
                <li>Returns the top 20 least-conflicted schedules ranked by your preferred metric</li>
                <li>Shows a timeline heatmap for each candidate so you can visualize conflicts visually</li>
              </ul>
              <p><strong>Note:</strong> This feature is under active development and will be significantly redesigned with more granular constraints and personal configuration options.</p>
            </details>
          </div>
          <AnalyticsResults data={ui.analyticsResp} />
        {/if}
      </div>
    </div>
  </div>
{/if}

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

  .muted {
    font-size: 0.75rem;
    color: var(--text-muted);
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
    gap: 0.25rem;
  }

  h2 {
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

  .btn-analytics {
    background: var(--card-bg);
    color: var(--text-main);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.5rem 0.8rem;
    transition: all 0.2s;
  }

  .btn-analytics:hover {
    border-color: var(--primary);
    background: #f1f5f9;
  }

  .btn-analytics:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }

  /* Modal Styles */
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;

    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;

    z-index: 1000;
    animation: fadeIn 0.2s ease-out;
  }

  /* Full-screen click-catcher behind the modal */
  .modal-overlay-close {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;

    border: 0;
    padding: 0;
    margin: 0;
    background: transparent;
    cursor: pointer;
  }
  .modal-overlay-close:focus {
    outline: none;
  }
  .modal-overlay-close:focus-visible {
    outline: 2px solid rgba(74, 144, 226, 0.9);
    outline-offset: -2px;
  }

  /* Make sure modal is above the overlay button */
  .modal-content {
    position: relative;
    z-index: 1;
    cursor: default;
    background: var(--card-bg);
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    width: 95vw;
    max-width: 1200px;
    max-height: 95vh;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.2s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .modal-title {
    font-size: 1rem;
    font-weight: 700;
    color: #111827;
    padding-left: 6px;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .modal-close {
    background: transparent;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-muted);
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .modal-close:hover {
    background: var(--bg);
    color: var(--text-main);
  }

  .modal-body {
    overflow-y: auto;
    flex: 1;
    padding: 0.5rem;
  }

  .analytics-intro {
    background: #f9fafb;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1rem;
    margin-bottom: 1rem;
    font-size: 0.9rem;
    line-height: 1.6;
    color: var(--text-main);
  }

  .analytics-intro p {
    margin: 0 0 0.5rem 0;
  }

  .analytics-intro p:first-child {
    font-weight: 600;
    color: var(--primary);
  }

  .analytics-intro p:last-of-type {
    margin-bottom: 0;
  }

  .tech-details {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
  }

  .tech-details summary {
    cursor: pointer;
    font-weight: 500;
    color: var(--primary);
    user-select: none;
  }

  .tech-details summary:hover {
    text-decoration: underline;
  }

  .tech-details ul {
    margin: 0.5rem 0 0.75rem 1.25rem;
    padding: 0;
  }

  .tech-details li {
    margin: 0.25rem 0;
    color: #555;
    font-size: 0.85rem;
    line-height: 1.5;
  }

  .tech-details p {
    font-size: 0.85rem;
    color: #777;
    font-style: italic;
    margin: 0.5rem 0 0 0;
  }

  @media (max-width: 484px) {
    .analytics-intro {
      padding: 0.75rem;
      font-size: 0.85rem;
    }

    .tech-details ul {
      margin-left: 1rem;
      font-size: 0.8rem;
    }
  }

  .alert {
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid;
  }

  .alert-error {
    background: #fef2f2;
    border-color: #fecaca;
    color: #991b1b;
  }

  .alert h3 {
    margin: 0 0 0.5rem 0;
    color: inherit;
  }

  .alert p {
    margin: 0;
    color: inherit;
  }

  @media (max-width: 484px) {
    .instances-list {
      grid-template-columns: 1fr;
    }

    .modal-header {
      padding: 1rem;
    }

    .modal-body {
      padding: 1rem;
    }
  }
</style>
