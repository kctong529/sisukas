<script lang="ts">
  import { useSession, authClient } from "../lib/authClient";
  import { onMount } from "svelte";

  const session = useSession();
  const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL;

  let email = "";
  let message = "";
  let loading = false;

  onMount(() => {
    console.debug("[AuthDebugPanel] mounted");
  });

  async function handleMagicLink() {
    loading = true;
    message = "";

    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: `${FRONTEND_URL}/`,
    });

    if (error && error.message) {
      message = error.message;
    } else {
      message = "Magic link sent (check email / server logs)";
    }

    loading = false;
  }

  async function handleSignOut() {
    await authClient.signOut();
  }
</script>

<div class="auth-debug">
  <h3>Auth Debug Panel</h3>

  <section>
    <strong>Status</strong>
    {#if $session.isPending}
      <p>Loading session…</p>
    {:else if $session.error}
      <p class="error">Error: {$session.error.message}</p>
    {:else if $session.data?.user}
      <p class="success">
        Logged in as <code>{$session.data.user.email}</code>
      </p>
    {:else}
      <p>Not logged in</p>
    {/if}
  </section>

  <section>
    <strong>Session JSON</strong>
    <details>
      <summary>View raw session</summary>
      <pre>{JSON.stringify($session, null, 2)}</pre>
    </details>
  </section>

  <section class="controls">
    <h4>Magic Link Test</h4>
    <input
      type="email"
      placeholder="email@example.com"
      bind:value={email}
    />

    <button on:click={handleMagicLink} disabled={loading || !email}>
      {loading ? "Sending…" : "Send magic link"}
    </button>

    {#if $session.data?.user}
      <button class="secondary" on:click={handleSignOut}>
        Sign out
      </button>
    {/if}

    {#if message}
      <p class="message">{message}</p>
    {/if}
  </section>
</div>

<style>
  .auth-debug {
    margin: 1rem;
    padding: 1rem;
    border: 1px dashed #ccc;
    border-radius: 8px;
    background: #fafafa;
    font-size: 0.9rem;
    max-width: 600px;
  }

  h3 {
    margin-top: 0;
    color: #333;
  }

  section {
    margin-top: 0.75rem;
  }

  pre {
    background: #111;
    color: #0f0;
    padding: 0.75rem;
    border-radius: 6px;
    max-height: 300px;
    overflow: auto;
    font-size: 0.75rem;
  }

  input {
    padding: 0.4rem 0.6rem;
    width: 400px;
    margin-bottom: 0.5rem;
  }

  button {
    margin-right: 0.5rem;
    padding: 0.4rem 0.75rem;
    cursor: pointer;
  }

  button.secondary {
    background: #eee;
  }

  .error {
    color: #c00;
  }

  .success {
    color: #0a7;
  }

  .message {
    margin-top: 0.5rem;
    font-style: italic;
  }
</style>
