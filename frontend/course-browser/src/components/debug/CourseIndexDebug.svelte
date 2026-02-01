<script lang="ts">
  import { courseIndexStore } from "../../lib/stores/courseIndexStore.svelte";
  import type { Course } from "../../domain/models/Course";

  let isOpen = $state(false);
  
  const activeCourses = $derived.by(() => courseIndexStore.read.getAllActiveCourses());
  const historicalCourses = $derived.by(() => courseIndexStore.read.getAllHistoricalCourses());
  const currentCourses = $derived.by(() => courseIndexStore.read.getAllCurrentCourses());

  function toggleMode() {
    courseIndexStore.actions.toggleMode();
  }

  async function bootstrap() {
    try {
      await courseIndexStore.actions.bootstrap();
    } catch (err) {
      console.error("Failed to bootstrap:", err);
    }
  }

  function getCourseLabel(course: Course): string {
    const code = course.code.value;
    const name = typeof course.name === "string" ? course.name : course.name?.en ?? "Untitled";
    return `${code} — ${name}`;
  }
</script>

<div class="debug-panel" data-index="5">
  <button class="debug-toggle" onclick={() => (isOpen = !isOpen)}>
    📚 Course Index Store {isOpen ? "▼" : "▶"}
  </button>

  {#if isOpen}
    <div class="debug-content">
      <div class="section">
        <h4>Status</h4>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="label">Mode:</span>
            <span class="value">{courseIndexStore.state.mode}</span>
          </div>

          <div class="stat-item">
            <span class="label">Loading:</span>
            <span class="value" class:active={courseIndexStore.state.loading}>
              {courseIndexStore.state.loading ? "⏳ Yes" : "✓ No"}
            </span>
          </div>

          <div class="stat-item">
            <span class="label">Active:</span>
            <span class="value">{courseIndexStore.state.byInstanceId.size}</span>
          </div>

          <div class="stat-item">
            <span class="label">Historical:</span>
            <span class="value" class:warn={!courseIndexStore.state.historicalReady}>{courseIndexStore.state.historicalByInstanceId.size}</span>
          </div>

          <div class="stat-item">
            <span class="label">Total:</span>
            <span class="value">{currentCourses.length}</span>
          </div>

          <div class="stat-item">
            <span class="label">Historical ready:</span>
            <span class="value" class:ok={courseIndexStore.state.historicalReady}>
              {courseIndexStore.state.historicalReady ? "✓ Yes" : "— No"}
            </span>
          </div>
        </div>
      </div>

      <div class="section">
        <h4>View</h4>
        <button class="action-btn primary" onclick={toggleMode}>
          Switch to {courseIndexStore.state.mode === "active" ? "All" : "Active"}
        </button>
      </div>

      <div class="section">
        <h4>Active Courses ({activeCourses.length})</h4>
        <div class="list" style="--dbg-list-max-height: 120px;">
          {#each activeCourses as course (course.id)}
            <div class="item">
              <span class="mono" title={course.id}>{getCourseLabel(course)}</span>
            </div>
          {/each}
          {#if activeCourses.length === 0}
            <div class="empty">No active courses</div>
          {/if}
        </div>
      </div>

      <div class="section">
        <h4>Historical Courses ({historicalCourses.length})</h4>
        <div class="list" style="--dbg-list-max-height: 120px;">
          {#each historicalCourses as course (course.id)}
            <div class="item">
              <span class="mono" title={course.id}>{getCourseLabel(course)}</span>
            </div>
          {/each}
          {#if historicalCourses.length === 0}
            <div class="empty">No historical courses</div>
          {/if}
        </div>
      </div>

      {#if courseIndexStore.state.error}
        <div class="section error">
          <h4>⚠️ Error</h4>
          <div class="error-message">{courseIndexStore.state.error}</div>
        </div>
      {/if}

      <div class="actions">
        <button class="action-btn primary" onclick={bootstrap}>Bootstrap</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .debug-panel {
    --dbg-max-width: 450px;
    --dbg-max-height: 620px;
    --dbg-content-max-height: 570px;
  }
</style>
