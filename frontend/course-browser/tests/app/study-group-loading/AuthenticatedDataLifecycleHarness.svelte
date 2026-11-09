<script lang="ts">
  import AuthenticatedDataLifecycle from "@app/auth/AuthenticatedDataLifecycle.svelte";

  import type { Readable } from "svelte/store";

  type SessionContext = { pending: boolean; userId: string | null };
  let { session }: { session: Readable<SessionContext> } = $props();
</script>

<AuthenticatedDataLifecycle pending={$session.pending} userId={$session.userId} />
