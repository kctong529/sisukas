<!-- src/components/AuthDebugPanel.svelte -->
<script lang="ts">
  import { useSession, authClient } from '../lib/authClient';

  const session = useSession();
  const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL;

  let email = $state('');
  let message = $state('');
  let loading = $state(false);
  let isOpen = $state(false);

  async function handleMagicLink() {
    loading = true;
    message = '';

    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: `${FRONTEND_URL}/`,
    });

    if (error && error.message) {
      message = error.message;
    } else {
      message = 'Magic link sent (check email / server logs)';
    }

    loading = false;
  }

  async function handleSignOut() {
    await authClient.signOut();
  }

  function togglePanel() {
    isOpen = !isOpen;
  }
</script>

<div class="debug-panel" data-index="4">
  <button class="debug-toggle" onclick={togglePanel}>
    🔐 Auth Debug {isOpen ? '▼' : '▶'}
  </button>

  {#if isOpen}
    <div class="debug-content">
      <!-- Status Section -->
      <div class="section">
        <h4>Status</h4>
        {#if $session.isPending}
          <div class="status-item pending">Loading session…</div>
        {:else if $session.error}
          <div class="status-item error">
            Error: {$session.error.message}
          </div>
        {:else if $session.data?.user}
          <div class="status-item success">
            Logged in as <code>{$session.data.user.email}</code>
          </div>
        {:else}
          <div class="status-item">Not logged in</div>
        {/if}
      </div>

      <!-- Magic Link Test Section -->
      <div class="section">
        <h4>Magic Link Test</h4>
        <input
          type="email"
          placeholder="email@example.com"
          bind:value={email}
          class="input"
        />
        <button
          onclick={handleMagicLink}
          disabled={loading || !email}
          class="action-btn primary"
        >
          {loading ? 'Sending…' : 'Send'}
        </button>
        {#if $session.data?.user}
          <button onclick={handleSignOut} class="action-btn danger">
            Sign Out
          </button>
        {/if}
        {#if message}
          <div class="message">{message}</div>
        {/if}
      </div>

      <!-- Session JSON Section -->
      <div class="section">
        <details class="json-details">
          <summary>View Raw Session</summary>
          <pre>{JSON.stringify($session, null, 2)}</pre>
        </details>
      </div>
    </div>
  {/if}
</div>

<style>
  /* sizing overrides only */
  .debug-panel {
    --dbg-max-width: 400px;
    --dbg-content-max-height: 500px;
  }

  /* panel-specific visuals */
  .status-item {
    padding: 0.5rem;
    background: var(--dbg-muted-bg);
    border-radius: 4px;
    border-left: 3px solid #6c757d;
  }
  .status-item.pending {
    border-left-color: var(--dbg-yellow);
    background: #fffbf0;
  }
  .status-item.success {
    border-left-color: var(--dbg-green);
    background: #f0f9f7;
    color: #155724;
  }
  .status-item.error {
    border-left-color: var(--dbg-red);
    background: #fdf8f8;
    color: #842029;
  }

  .message {
    padding: 0.5rem;
    margin-top: 0.5rem;
    background: #e7f3ff;
    border-left: 3px solid var(--dbg-blue);
    border-radius: 4px;
    color: #004085;
    font-size: 0.7rem;
  }

  .json-details summary {
    padding: 0.5rem;
    background: var(--dbg-muted-bg);
    border-radius: 4px;
    border: 1px solid var(--dbg-muted-border);
    font-weight: 600;
    user-select: none;
    cursor: pointer;
  }
  .json-details summary:hover {
    background: #e9ecef;
  }

  pre {
    background: #1e1e1e;
    color: #d4d4d4;
    padding: 0.75rem;
    border-radius: 4px;
    margin: 0.5rem 0 0;
    max-height: 250px;
    overflow: auto;
    font-size: 0.7rem;
  }
</style>
