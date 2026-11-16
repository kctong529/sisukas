<!-- src/components/auth/AuthModal.svelte -->
<script lang="ts">
  import { onMount } from "svelte";

  import { googleSignInEnabled, signInWithGoogle, signInWithMagicLink, useSession } from "@modules/auth";

  type Props = {
    onclose?: () => void;
    initialError?: string;
  };

  let { onclose, initialError }: Props = $props();

  const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL;
  const session = useSession();

  let email = $state("");
  let message = $state("");
  let messageType = $state<"success" | "error" | null>(null);
  type AuthOperation = "google" | "magic-link" | null;

  let activeOperation = $state<AuthOperation>(null);
  const loading = $derived(activeOperation !== null);
  let dialog: HTMLDialogElement;

  $effect(() => {
      if (initialError) {
          message = initialError;
          messageType = "error";
      }
  });

  onMount(() => {
    if (!dialog.open) dialog.showModal();
  });

  $effect(() => {
    if ($session.data?.user && dialog?.open) {
      closeModal();
    }
  });

  function closeModal() {
    if (dialog?.open) dialog.close();
  }

  function handleDialogClose() {
    onclose?.();
  }

  async function handleGoogleSignIn() {
    if (loading) return;

    activeOperation = "google";
    message = "";
    messageType = null;

    try {
      const { error } = await signInWithGoogle(`${FRONTEND_URL}/`);
      if (error) {
        message = error.message ?? "Could not start Google sign-in.";
        messageType = "error";
      }
      // On success, Better Auth redirects the browser to Google.
    } catch {
      message = "Could not start Google sign-in.";
      messageType = "error";
    } finally {
      activeOperation = null;
    }
  }

  async function handleMagicLink(event: SubmitEvent) {
    event.preventDefault();
    if (loading || !email.trim()) return;

    activeOperation = "magic-link";
    message = "";
    messageType = null;

    try {
      const { error } = await signInWithMagicLink(email, `${FRONTEND_URL}/`);

      if (error) {
        message = error.message ?? "Failed to send sign-in link.";
        messageType = "error";
      } else {
        message = "Check your email for the sign-in link ✉️";
        messageType = "success";
      }
    } catch {
      message = "Failed to send sign-in link.";
      messageType = "error";
    } finally {
      activeOperation = null;
    }
  }
</script>

<dialog
  bind:this={dialog}
  onclick={(event) => {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  }}
  onclose={handleDialogClose}
  aria-labelledby="modal-title"
>
  <div class="modal-content">
    <button class="close-btn" onclick={closeModal} aria-label="Close">
      <i class="bi bi-x"></i>
    </button>

    <div class="header">
      <div class="brand-icon">
        <i class="bi bi-person-lock"></i>
      </div>
      <h2 id="modal-title">Sign in to Sisukas</h2>
      <p class="subtitle">Sign in with your email or an available provider</p>
    </div>

    {#if message && messageType === "error"}
      <div class="message" role="alert">
        <i class="bi bi-exclamation-circle" aria-hidden="true"></i>
        {message}
      </div>
    {/if}

    {#if googleSignInEnabled}
      <!--
        Replace the placeholder with Google's pre-approved light rectangular
        SVG asset. See BRANDING.md for the required asset and its source.
        Authentication remains handled by Better Auth, not Google Identity Services.
      -->
      <button
        class="google-btn"
        type="button"
        disabled={loading}
        aria-label={activeOperation === "google" ? "Starting Google sign-in" : "Sign in with Google"}
        onclick={handleGoogleSignIn}
      >
        <img
          class="google-button-image"
          src="/images/google-signin-light.svg"
          alt=""
        />
        {#if activeOperation === "google"}
          <span class="google-loading-overlay" aria-hidden="true">Connecting...</span>
        {/if}
      </button>
      <p class="provider-note">Already use a magic link? Sign in with email first. Google cannot automatically link an existing account.</p>
      <div class="auth-divider" aria-hidden="true"><span>or use email</span></div>
    {/if}

    <form class="form-group" onsubmit={handleMagicLink}>
      <div class="input-wrapper">
        <i class="bi bi-envelope"></i>
        <input
          type="email"
          required
          autocomplete="email"
          aria-label="Email address"
          placeholder="you@aalto.fi"
          bind:value={email}
        />
      </div>

      <button
        class="submit-btn"
        type="submit"
        disabled={loading || !email.trim()}
      >
        {#if activeOperation === "magic-link"}
          <span class="spinner"></span>
          Sending...
        {:else}
          <i class="bi bi-magic"></i>
          Send magic link
        {/if}
      </button>
    </form>

    {#if message && messageType === "success"}
      <div class="message success" role="status">
        <i class="bi bi-check-circle" aria-hidden="true"></i>
        {message}
      </div>
    {/if}
  </div>
</dialog>

<style>
  dialog {
    padding: 0;
    border: none;
    border-radius: 12px;
    background: white;
    box-shadow: 0 15px 30px rgba(0, 0, 0, 0.2);
    max-width: 400px;
    width: 90%;
    overflow: hidden;
  }

  dialog::backdrop {
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(2px);
  }

  .modal-content {
    padding: 2.5rem 2rem;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* Close Button */
  .close-btn {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    background: none;
    border: none;
    font-size: 1.8rem;
    cursor: pointer;
    color: #888;
    line-height: 1;
    padding: 4px;
    border-radius: 50%;
    transition: background 0.2s;
  }

  .close-btn:hover {
    background: #f0f0f0;
    color: #333;
  }

  /* Header Section */
  .header {
    text-align: center;
  }

  .brand-icon {
    font-size: 2.5rem;
    color: #2f7fd6;
    margin-bottom: 0.5rem;
  }

  h2 {
    margin: 0;
    font-size: 1.5rem;
    color: #333;
  }

  .subtitle {
    color: #666;
    margin-top: 0.5rem;
    font-size: 0.95rem;
  }

  /* The button's complete appearance comes from Google's pre-approved asset. */
  .google-btn {
    display: block;
    position: relative;
    width: 100%;
    max-width: 240px;
    margin-inline: auto;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
    line-height: 0;
  }

  .google-button-image {
    display: block;
    width: 100%;
    height: auto;
    object-fit: contain;
  }

  .google-btn:disabled { cursor: wait; }
  .google-btn:disabled .google-button-image { opacity: 0.6; }
  .google-btn:focus-visible {
    outline: 2px solid var(--ui-focus-ring);
    outline-offset: 2px;
  }

  .google-loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.9);
    color: #1f1f1f;
    font-size: 14px;
    font-weight: 500;
    line-height: normal;
  }

  .provider-note {
    margin: -0.75rem 0 0;
    font-size: 0.8rem;
    line-height: 1.45;
    color: #586375;
  }

  .auth-divider {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    color: #64748b;
    font-size: 0.85rem;
  }

  .auth-divider::before,
  .auth-divider::after {
    content: "";
    height: 1px;
    flex: 1;
    background: #cbd5e1;
  }

  /* Form Elements */
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .input-wrapper i {
    position: absolute;
    left: 1rem;
    color: #888;
  }

  input {
    width: 100%;
    padding: 0.8rem 1rem 0.8rem 2.8rem;
    border-radius: 6px;
    border: 1px solid #ddd;
    font-size: 1rem;
    outline: none;
    transition: border-color 0.2s;
  }

  input:focus {
    border-color: #2f7fd6;
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
  }

  input:focus-visible {
    outline: 2px solid var(--ui-focus-ring);
    outline-offset: 2px;
  }

  .submit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    width: 100%;
    padding: 0.8rem;
    border-radius: 6px;
    border: none;
    background: #2f7fd6;
    color: white;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .submit-btn:hover:not(:disabled) {
    background: #357abd;
  }

  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Feedback Message */
  .message {
    padding: 0.8rem;
    border-radius: 6px;
    background: var(--ui-danger-surface);
    color: var(--ui-danger);
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid var(--ui-danger-border);
  }

  .message.success {
    background: #f0f9ff;
    color: #0077cc;
    border-color: #d0e8ff;
  }

  /* Entrance Animation */
  dialog[open] {
    animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
