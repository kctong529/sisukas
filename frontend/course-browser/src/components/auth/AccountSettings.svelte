<script lang="ts">
  import { onMount } from "svelte";

  import { type ConnectedMethods, getConnectedMethods } from "@modules/auth";

  type Props = {
    email: string;
    onclose?: () => void;
  };

  let { email, onclose }: Props = $props();

  let dialog: HTMLDialogElement;
  let loading = $state(true);
  let error = $state<string | null>(null);
  let methods = $state<ConnectedMethods | null>(null);

  // A closed dialog must not be updated by a pending provider request.
  let disposed = false;
  let requestId = 0;

  async function refreshMethods() {
    const currentRequest = ++requestId;
    loading = true;
    error = null;
    methods = null;

    try {
      const result = await getConnectedMethods();
      if (!disposed && currentRequest === requestId) methods = result;
    } catch {
      if (!disposed && currentRequest === requestId) {
        error = "Could not load connected sign-in methods.";
      }
    } finally {
      if (!disposed && currentRequest === requestId) loading = false;
    }
  }

  onMount(() => {
    dialog.showModal();
    void refreshMethods();

    return () => {
      disposed = true;
      requestId += 1;
      if (dialog.open) dialog.close();
    };
  });

  function closeModal() {
    if (dialog.open) dialog.close();
  }

  function handleDialogClose() {
    disposed = true;
    requestId += 1;
    onclose?.();
  }
</script>

<dialog
  bind:this={dialog}
  aria-labelledby="account-settings-title"
  onclose={handleDialogClose}
  onclick={(event) => {
    if (event.target === event.currentTarget) closeModal();
  }}
>
  <div class="modal-content">
    <button
      class="close-btn"
      type="button"
      aria-label="Close account settings"
      onclick={closeModal}
    >
      <i class="bi bi-x" aria-hidden="true"></i>
    </button>

    <h2 id="account-settings-title">Account settings</h2>

    <section aria-label="Account information">
      <h3>Account email</h3>
      <p class="account-email">{email}</p>
    </section>

    <section aria-labelledby="sign-in-methods-title">
      <h3 id="sign-in-methods-title">Sign-in methods</h3>
      <div class="method-row">
        <div class="method-description">
          <strong><i class="bi bi-envelope" aria-hidden="true"></i> Email magic link</strong>
          <p>Available for your email</p>
        </div>
        <span class="method-status">Available</span>
      </div>

      {#if loading}
        <p role="status">Loading connected methods...</p>
      {:else if error}
        <div role="alert" class="load-error">
          <p>{error}</p>
          <button type="button" onclick={refreshMethods}>Retry</button>
        </div>
      {:else if methods}
        <div class="method-row">
          <div class="method-description">
            <strong><i class="bi bi-google" aria-hidden="true"></i> Google</strong>
            <p>{methods.googleConnected ? "Connected to this account" : "Not connected"}</p>
          </div>
          <span class="method-status">
            {methods.googleConnected ? "Connected" : "Not connected"}
          </span>
        </div>
      {/if}
    </section>
  </div>
</dialog>

<style>
  dialog {
    width: min(90vw, 440px);
    max-height: min(85vh, 700px);
    overflow-y: auto;
    padding: 0;
    border: none;
    border-radius: 12px;
    background: white;
    color: #333;
    box-shadow: 0 15px 30px rgba(0, 0, 0, 0.2);
  }

  dialog::backdrop {
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(2px);
  }

  .modal-content {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 2rem;
  }

  .close-btn {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    padding: 0.25rem;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: #666;
    cursor: pointer;
    font-size: 1.5rem;
  }

  .close-btn:hover { background: #f0f0f0; }
  h2 { margin: 0 1.5rem 0 0; font-size: 1.5rem; }
  h3 { margin: 0 0 0.75rem; font-size: 1rem; }
  .account-email { margin: 0; overflow-wrap: anywhere; }
  .method-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 0.85rem 0;
    border-bottom: 1px solid #ddd;
  }
  .method-description { min-width: 0; }
  .method-description strong { display: flex; gap: 0.5rem; align-items: center; }
  .method-description p { margin: 0.3rem 0 0; color: #586375; font-size: 0.85rem; }
  .method-status { flex-shrink: 0; color: #586375; font-size: 0.8rem; }
  .load-error { color: var(--ui-danger); }
  .load-error button { margin-top: 0.5rem; cursor: pointer; }
  button:focus-visible { outline: 2px solid var(--ui-focus-ring); outline-offset: 2px; }
</style>
