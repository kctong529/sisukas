<script lang="ts">
  import { untrack } from "svelte";

  import { activePlanStudyGroupRequests } from "@app/study-group-loading/activePlanRequests";
  import { calendarVisibilitySessionStore } from "@lib/stores/calendarVisibilitySessionStore.svelte";
  import { courseGradeStore } from "@lib/stores/courseGradeStore";
  import { courseIndexStore } from "@lib/stores/courseIndexStore.svelte";
  import { favouritesStore } from "@lib/stores/favouritesStore";
  import { plansStore } from "@lib/stores/plansStore.svelte";
  import { getStudyGroupDataRuntime } from "@modules/study-groups";

  import { createAuthenticatedPlanLifecycle } from "./authenticatedPlanLifecycle";

  let { pending, userId }: { pending: boolean; userId: string | null } = $props();

  const lifecycle = createAuthenticatedPlanLifecycle(
    plansStore.actions,
    (error) => console.error("Failed to initialize account data:", error),
    {
      favourites: favouritesStore,
      grades: courseGradeStore,
      calendarPreferences: calendarVisibilitySessionStore.actions,
      studyGroups: {
        clear: () => {
          getStudyGroupDataRuntime().clear();
        },
      },
    },
  );

  $effect(() => {
    // Only authentication inputs determine account transitions.
    const currentPending = pending;
    const currentUserId = userId;
    untrack(() => lifecycle.update(currentPending, currentUserId));
  });

  // Calendar preferences depend on the authenticated account and active plan,
  // not on course-index or study-group availability.
  const calendarPreferenceKey = $derived.by(() => {
    if (pending || !userId || !plansStore.state.loaded) return null;

    const plan = plansStore.read.getActive();
    if (!plan || plan.userId !== userId) return null;

    return JSON.stringify([userId, plan.id]);
  });

  $effect(() => {
    if (!calendarPreferenceKey) return;

    // The primitive key prevents unrelated updates from triggering hydration.
    // The store deduplicates requests and discards obsolete account responses.
    const [accountId, planId] = JSON.parse(calendarPreferenceKey) as [string, string];
    void calendarVisibilitySessionStore.actions.ensureLoaded(accountId, planId);
  });

  // Derive requested offering identities from the plan and catalogue. The
  // signature is primitive, so unrelated store updates cannot restart loading.
  const activePlanRequests = $derived.by(() => {
    if (pending || !userId || !plansStore.state.loaded) return [];
    if (!courseIndexStore.state.activeReady) return [];

    const plan = plansStore.read.getActive();
    if (!plan) return [];

    return activePlanStudyGroupRequests(
      plan,
      courseIndexStore.read.resolveByInstanceId,
    );
  });

  const requestSignature = $derived(JSON.stringify(activePlanRequests));

  // A single primitive key avoids restarting retrieval when the session store
  // publishes a new object with the same settled account and offerings.
  const loadingKey = $derived(
    !pending && userId && requestSignature !== "[]"
      ? JSON.stringify([userId, requestSignature])
      : null,
  );

  $effect(() => {
    if (!loadingKey) return;

    // Only the stable loading key is tracked by this effect. The runtime owns
    // request deduplication; no additional request cache is maintained here.
    const requests = untrack(() => activePlanRequests);
    let current = true;
    void getStudyGroupDataRuntime().ensure(requests).catch((error: unknown) => {
      if (current) console.error("Failed to load active-plan study groups:", error);
    });

    return () => { current = false; };
  });
</script>
