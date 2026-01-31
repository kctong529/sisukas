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

<div class="debug-panel" data-index="1">
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
          class="action-btn"
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
  .debug-panel {
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    font-family: monospace;
    font-size: 0.75rem;
    max-width: 400px;
    max-height: 580px;
  }

  .debug-toggle {
    width: 100%;
    padding: 0.75rem;
    background: #2c3e50;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: background 0.2s;
  }

  .debug-toggle:hover {
    background: #1a252f;
  }

  .debug-content {
    padding: 1rem;
    max-height: 500px;
    overflow-y: auto;
    border-top: 1px solid #ddd;
  }

  .section {
    margin-bottom: 1rem;
  }

  .section:last-of-type {
    margin-bottom: 0;
  }

  h4 {
    margin: 0 0 0.5rem;
    color: #2c3e50;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .status-item {
    padding: 0.5rem;
    background: #f8f9fa;
    border-radius: 4px;
    border-left: 3px solid #6c757d;
  }

  .status-item.pending {
    border-left-color: #ffc107;
    background: #fffbf0;
  }

  .status-item.success {
    border-left-color: #198754;
    background: #f0f9f7;
    color: #155724;
  }

  .status-item.error {
    border-left-color: #d9534f;
    background: #fdf8f8;
    color: #842029;
  }

  code {
    background: #e9ecef;
    padding: 0.2rem 0.4rem;
    border-radius: 3px;
  }

  .input {
    display: block;
    width: 100%;
    padding: 0.5rem;
    margin-bottom: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-family: inherit;
    font-size: 0.75rem;
  }

  .input:focus {
    outline: none;
    border-color: #0d6efd;
    box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.1);
  }

  .action-btn {
    display: inline-block;
    padding: 0.5rem 0.75rem;
    margin-right: 0.5rem;
    margin-bottom: 0.5rem;
    background: #0d6efd;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.75rem;
    transition: background 0.2s;
  }

  .action-btn:hover:not(:disabled) {
    background: #0b5ed7;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.danger {
    background: #d9534f;
  }

  .action-btn.danger:hover {
    background: #c82333;
  }

  .message {
    padding: 0.5rem;
    margin-top: 0.5rem;
    background: #e7f3ff;
    border-left: 3px solid #0d6efd;
    border-radius: 4px;
    color: #004085;
    font-size: 0.7rem;
  }

  .json-details {
    cursor: pointer;
  }

  .json-details summary {
    padding: 0.5rem;
    background: #f8f9fa;
    border-radius: 4px;
    border: 1px solid #e9ecef;
    font-weight: 600;
    user-select: none;
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