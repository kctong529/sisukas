import { flushSync } from "svelte";
import { calendarProjectionStore } from "../../../src/lib/stores/calendarProjectionStore.svelte";
import type { CalendarProjectionResult } from "../../../src/domain/services/CalendarProjection";

/** Mounts an actual Svelte effect, not just an imperative getter assertion. */
export function observeProjection() {
  const seen: Array<CalendarProjectionResult | null> = [];
  const dispose = $effect.root(() => {
    $effect(() => {
      seen.push(calendarProjectionStore.projection);
    });
  });
  flushSync();
  return { seen, dispose };
}
