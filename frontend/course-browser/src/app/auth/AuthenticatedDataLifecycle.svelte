<script lang="ts">
  import { plansStore } from "@lib/stores/plansStore.svelte";

  import { createAuthenticatedPlanLifecycle } from "./authenticatedPlanLifecycle";

  let { pending, userId }: { pending: boolean; userId: string | null } = $props();

  const lifecycle = createAuthenticatedPlanLifecycle(
    plansStore.actions,
    (error) => console.error("Failed to initialize plans:", error),
  );

  $effect(() => {
    lifecycle.update(pending, userId);
  });
</script>
