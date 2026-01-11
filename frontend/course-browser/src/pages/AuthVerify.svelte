<script lang="ts">
  import { onMount } from "svelte";
  
  let token: string | null = null;

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    token = params.get('token');
  });

  function proceed() {
    if (!token) return;
    // This triggers your server.ts app.get("/api/auth/magic-link/verify") logic
    window.location.href = `${import.meta.env.VITE_BACKEND_URL}/api/auth/magic-link/verify?token=${token}`;
  }
</script>

<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 80vh; font-family: sans-serif;">
  <h1>Confirm Sign-In</h1>
  <p>Please click the button below to sign in to Sisukas.</p>
  
  <button 
    on:click={proceed}
    style="padding: 1rem 2rem; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1.1rem;"
  >
    Verify & Sign In
  </button>
</div>