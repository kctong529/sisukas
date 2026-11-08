<script lang="ts">
  import { courseGradeStore } from "@lib/stores/courseGradeStore";
  import { favouritesStore } from "@lib/stores/favouritesStore";
  import { plansStore } from "@lib/stores/plansStore.svelte";

  import { createAuthenticatedPlanLifecycle } from "./authenticatedPlanLifecycle";

  let { pending, userId }: { pending: boolean; userId: string | null } = $props();

  const lifecycle = createAuthenticatedPlanLifecycle(
    plansStore.actions,
    (error) => console.error("Failed to initialize account data:", error),
    { favourites: favouritesStore, grades: courseGradeStore },
  );

  $effect(() => {
    lifecycle.update(pending, userId);
  });
</script>
