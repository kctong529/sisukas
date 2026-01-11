<!-- src/pages/AuthCallback.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';

  onMount(async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code) {
      // No code, redirect to home
      window.location.href = '/';
      return;
    }

    try {
      // Exchange the short-lived code for a session cookie
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/exchange-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
        credentials: 'include',
      });

      if (!res.ok) {
        console.error('Exchange code failed', await res.text());
        window.location.href = '/auth/error';
        return;
      }

      // Session cookie is now set, redirect to main page or dashboard
      window.location.href = '/';
    } catch (err) {
      console.error('Error exchanging code:', err);
      window.location.href = '/auth/error';
    }
  });
</script>

<p style="text-align:center; padding: 2rem;">
  Signing you in...
</p>