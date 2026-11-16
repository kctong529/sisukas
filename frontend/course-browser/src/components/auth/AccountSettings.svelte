<script lang="ts">
  import { onMount } from "svelte";

  import {
    clearPendingGoogleLink,
    type ConnectedMethods,
    evaluateGoogleLinkReturn,
    getConnectedMethods,
    googleLinkCallbackURL,
    type GoogleLinkReturn,
    linkGoogle,
    savePendingGoogleLink,
  } from "@modules/auth";

  type Props = {
    email: string;
    userId: string;
    linkReturn?: GoogleLinkReturn | null;
    onclose?: () => void;
  };

  let { email, userId, linkReturn = null, onclose }: Props = $props();

  let dialog: HTMLDialogElement;
  let loading = $state(true);
  let error = $state<string | null>(null);
  let methods = $state<ConnectedMethods | null>(null);
  let linking = $state(false);
  let linkNotice = $state<string | null>(null);
  let linkSucceeded = $state(false);

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
      if (!disposed && currentRequest === requestId) {
        methods = result;
        if (linkReturn) {
          // Callback parameters are only routing hints, never proof of success.
          const outcome = evaluateGoogleLinkReturn(linkReturn, userId, result.googleConnected);
          linkSucceeded = outcome.success;
          linkNotice = outcome.message;
        }
      }
    } catch {
      if (!disposed && currentRequest === requestId) {
        error = "Could not load connected sign-in methods.";
      }
    } finally {
      if (!disposed && currentRequest === requestId) loading = false;
    }
  }

  async function handleConnectGoogle() {
    if (linking || loading || methods?.googleConnected || !userId) return;
    linking = true;
    linkNotice = null;
    try {
      savePendingGoogleLink(window.sessionStorage, userId);
      const callback = googleLinkCallbackURL(import.meta.env.VITE_FRONTEND_URL);
      const { error } = await linkGoogle(callback);
      if (error) {
        clearPendingGoogleLink(window.sessionStorage);
        linkNotice = "Could not start Google linking. Please try again.";
      }
      // Otherwise Better Auth navigates to Google.
    } catch {
      clearPendingGoogleLink(window.sessionStorage);
      linkNotice = "Could not start Google linking. Please try again.";
    } finally {
      linking = false;
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

    {#if linkNotice}
      <p
        class="link-notice"
        class:link-success={linkSucceeded}
        class:link-error={!linkSucceeded}
        role={linkSucceeded ? "status" : "alert"}
      >{linkNotice}</p>
    {/if}

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
            <strong><img class="google-mark" src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" /> Google</strong>
            <p>{methods.googleConnected ? "Connected to this account" : "Not connected"}</p>
          </div>
          {#if methods.googleConnected}
            <span class="method-status">Connected</span>
          {:else}
            <button type="button" disabled={linking} onclick={handleConnectGoogle}>
              {#if !linking}<img class="google-mark" src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" />{/if}
              {linking ? "Connecting..." : "Connect Google"}
            </button>
          {/if}
        </div>
      {/if}
    </section>
  </div>
</dialog>

<style>
  dialog {
    width: min(90vw, 440px);
    box-sizing: border-box;
    font-size: 16px;
    line-height: 1.5;
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
    min-width: 0;
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
  h2 { margin: 0 1.5rem 0 0; font-size: 1.5em; }
  h3 { margin: 0 0 0.75rem; font-size: 1em; }
  .account-email {
    margin: 0;
    font-size: 1em;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
  .method-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 0.85rem 0;
    border-bottom: 1px solid #ddd;
  }
  .method-description { min-width: 0; flex: 1; font-size: 1em; }
  .method-description strong { display: flex; gap: 0.5rem; align-items: center; font-size: 1em; }
  .method-description p { margin: 0.3rem 0 0; color: #586375; font-size: 0.875em; }
  .method-status { flex-shrink: 0; color: #586375; font-size: 0.875em; }
  .load-error { color: var(--ui-danger); }
  .link-notice { margin: 0; padding: 0.75rem; border-radius: 6px; font-size: 0.9375em; }
  .link-success { color: #176942; background: #edf8f1; }
  .link-error { color: #9b241c; background: #fff2f0; }
  .method-row button {
    display: inline-flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    cursor: pointer;
    min-height: 40px;
    padding: 0.4rem 0.75rem;
    border: 1px solid #747775;
    border-radius: 6px;
    background: white;
    color: #1f1f1f;
    font-size: 0.875em;
    font-weight: 500;
  }
  .google-mark { width: 18px; height: 18px; flex-shrink: 0; }
  .method-row button:disabled { cursor: wait; opacity: 0.65; }
  .load-error button { margin-top: 0.5rem; cursor: pointer; }
  button:focus-visible { outline: 2px solid var(--ui-focus-ring); outline-offset: 2px; }
  @media (max-width: 435px) {
    .modal-content { padding: 1.25rem; }
    .method-row { gap: 0.625rem; }
    .method-row button { padding: 0.5rem; }
  }
</style>
