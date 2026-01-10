<!-- src/components/AuthTest.svelte -->
<script lang="ts">
  import { useSession, authClient } from '../lib/auth-client';
  import { onMount } from 'svelte';
  
  const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL;

  const session = useSession();
  
  $: console.log('Session state:', {
    isPending: $session.isPending,
    error: $session.error,
    data: $session.data,
  });
  
  onMount(() => {
    console.log('AuthTest mounted');
  });

  let email = "";
  let message = "";
  let loading = false;

  async function handleMagicLink() {
    loading = true;
    const { data, error } = await authClient.signIn.magicLink({
      email,
      callbackURL: `${FRONTEND_URL}/`,
    });

    if (error) {
      message = "Error: " + error.message;
    } else {
      message = "Check your server terminal for the link!";
    }
    loading = false;
  }
</script>

<div style="border: 1px solid #ccc; padding: 1rem; margin: 1rem;">
  <h2>Auth Status</h2>
  
  {#if $session.isPending}
    <p>Loading session...</p>
  {:else if $session.error}
    <p style="color: red;">Error: {$session.error.message}</p>
  {:else if $session.data?.user}
    <p>Logged in as: {$session.data.user.email}</p>
  {:else}
    <p>Not logged in (session is null)</p>
  {/if}
  
  <details>
    <summary>Debug Info</summary>
    <pre>{JSON.stringify($session, null, 2)}</pre>
  </details>

  <div>
    <hr />
    <h3>Test Magic Link</h3>
    <input type="email" bind:value={email} placeholder="Enter email" />
    <button on:click={handleMagicLink} disabled={loading}>
      {loading ? 'Sending...' : 'Send Magic Link'}
    </button>
    
    {#if message}<p>{message}</p>{/if}
  </div>
</div>