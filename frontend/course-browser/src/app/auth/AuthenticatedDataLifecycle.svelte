<script lang="ts">
  import { activePlanStudyGroupRequests } from "@app/study-group-loading/activePlanRequests";
  import { courseGradeStore } from "@lib/stores/courseGradeStore";
  import { courseIndexStore } from "@lib/stores/courseIndexStore.svelte";
  import { favouritesStore } from "@lib/stores/favouritesStore";
  import { plansStore } from "@lib/stores/plansStore.svelte";
  import { studyGroupStore } from "@lib/stores/studyGroupStore.svelte";
  import { getStudyGroupDataRuntime } from "@modules/study-groups";

  import { createAuthenticatedPlanLifecycle } from "./authenticatedPlanLifecycle";

  let { pending, userId }: { pending: boolean; userId: string | null } = $props();

  const lifecycle = createAuthenticatedPlanLifecycle(
    plansStore.actions,
    (error) => console.error("Failed to initialize account data:", error),
    {
      favourites: favouritesStore,
      grades: courseGradeStore,
      studyGroups: {
        clear: () => {
          // Keep both paths isolated until consumers migrate in #174.
          studyGroupStore.actions.clear();
          getStudyGroupDataRuntime().clear();
        },
      },
    },
  );

  $effect(() => {
    // Invalidate the previous account before observing its plans.
    lifecycle.update(pending, userId);

    if (pending || !userId || !plansStore.state.loaded) return;
    if (!courseIndexStore.state.activeReady) return;

    const plan = plansStore.read.getActive();
    if (!plan) return;

    const requests = activePlanStudyGroupRequests(
      plan,
      courseIndexStore.read.resolveByInstanceId,
    );
    if (requests.length === 0) return;

    // The runtime owns deduplication, caching, and request scheduling.
    let current = true;
    void getStudyGroupDataRuntime().ensure(requests).catch((error: unknown) => {
      if (current) console.error("Failed to load active-plan study groups:", error);
    });

    return () => { current = false; };
  });
</script>
