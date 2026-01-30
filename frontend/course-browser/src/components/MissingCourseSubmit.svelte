<!-- src/components/MissingCourseSubmit.svelte -->
<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { NotificationService } from "../infrastructure/services/NotificationService";
  import { assertCourseCodeIsMissingEverywhere } from "../domain/services/CourseCodeGuard";
  import { CourseSnapshotsService } from "../infrastructure/services/CourseSnapshotsService";
  import { SnapshotHistoricalMerge } from "../infrastructure/loaders/SnapshotHistoricalMerge";

  type ResolveMissingCourseResponse = {
    courseCode: string;
    snapshots: unknown[];
  };

  /**
   * Props:
   * - resolveMissingCourseCode: the App-level function you already export
   *   (so this component stays dumb and doesn't duplicate logic)
   */
  export let resolveMissingCourseCode: (
    courseCode: string
  ) => Promise<ResolveMissingCourseResponse | null>;

  const dispatch = createEventDispatcher<{
    resolved: { courseCode: string; storedCount: number };
    merged: { fetched: number; merged: number; skipped: number };
  }>();

  let input = "";
  let busy = false;
  let lastStoredCount: number | null = null;
  let lastMerge: { fetched: number; merged: number; skipped: number } | null = null;

  function normalizeCourseCode(code: string): string {
    return code.trim().toUpperCase();
  }

  async function onSubmit() {
    if (busy) return;

    const raw = input;
    const g = assertCourseCodeIsMissingEverywhere(raw);
    if (!g.ok) {
      NotificationService.error(g.message);
      return;
    }

    const courseCode = normalizeCourseCode(g.code);

    busy = true;
    lastStoredCount = null;
    lastMerge = null;

    try {
      const res = await resolveMissingCourseCode(courseCode);
      if (!res) return;

      const storedCount = res.snapshots.length;

      lastStoredCount = storedCount;
      dispatch("resolved", { courseCode, storedCount });
      NotificationService.success(`Stored ${storedCount} snapshot(s) for ${courseCode}`);

      const merge = await SnapshotHistoricalMerge.mergeAllLiveSnapshots();
      lastMerge = merge;
      dispatch("merged", merge);

      NotificationService.success(
        `Merged ${merge.merged} snapshot course(s) into historical index`
      );

      input = "";
    } catch (err) {
      console.error("Missing course submit error:", err);
      NotificationService.error(err instanceof Error ? err.message : "Failed to submit course code");
    } finally {
      busy = false;
    }
  }
</script>

<div class="header">
  <p class="hint">
    Only accepts codes that do not exist in current courses or historical data.
  </p>
</div>

<form class="row" on:submit|preventDefault={onSubmit}>
  <input
    class="input"
    placeholder="e.g. CS-E4675"
    bind:value={input}
    disabled={busy}
    autocomplete="off"
    spellcheck="false"
  />

  <button class="btn" type="submit" disabled={busy || !input.trim()}>
    {#if busy}
      Working...
    {:else}
      Resolve and store
    {/if}
  </button>
</form>

{#if lastStoredCount !== null}
  <div class="status">
    <div><strong>Stored:</strong> {lastStoredCount} snapshot(s)</div>
    {#if lastMerge}
      <div>
        <strong>Merged:</strong> {lastMerge.merged} (fetched {lastMerge.fetched},
        skipped {lastMerge.skipped})
      </div>
    {/if}
  </div>
{/if}

<details class="advanced">
  <summary>Advanced</summary>

  <div class="advanced-row">
    <button
      class="btn secondary"
      type="button"
      disabled={busy}
      on:click={async () => {
        if (busy) return;
        busy = true;
        try {
          const merge = await SnapshotHistoricalMerge.mergeAllLiveSnapshots();
          lastMerge = merge;
          dispatch("merged", merge);
          NotificationService.success(`Merged ${merge.merged} snapshot course(s) into historical index`);
        } catch (e) {
          console.error(e);
          NotificationService.error(e instanceof Error ? e.message : "Merge failed");
        } finally {
          busy = false;
        }
      }}
    >
      Merge live snapshots now
    </button>

    <button
      class="btn secondary"
      type="button"
      disabled={busy || !input.trim()}
      on:click={async () => {
        const code = normalizeCourseCode(input);
        try {
          const status = await CourseSnapshotsService.getStatus(code);
          NotificationService.success(
            `${code}: hasAny=${status.hasAny}, hasLive=${status.hasLive}, live=${status.liveCount}/${status.totalCount}`
          );
        } catch (e) {
          console.error(e);
          NotificationService.error("Failed to check snapshot status");
        }
      }}
    >
      Check snapshot status
    </button>
  </div>
</details>

<style>
  .hint {
    margin: 0 0 12px 0;
    color: #666;
    font-size: 0.9rem;
  }

  .row {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .input {
    flex: 1;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid #ddd;
    font-size: 0.95rem;
    outline: none;
    background: #fff;
  }

  .input:disabled {
    opacity: 0.7;
    background: #f6f6f6;
  }

  .btn {
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid #ddd;
    background: #111;
    color: #fff;
    cursor: pointer;
    font-size: 0.95rem;
    white-space: nowrap;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn.secondary {
    background: #fff;
    color: #111;
  }

  .status {
    margin-top: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    background: #f7f7f7;
    border: 1px solid #eee;
    font-size: 0.92rem;
    color: #333;
    display: grid;
    gap: 6px;
  }

  .advanced {
    margin-top: 10px;
  }

  .advanced-row {
    margin-top: 10px;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
</style>
