<!-- src/components/AuthModal.svelte -->
<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { useSession, authClient } from "../lib/authClient";
  
  const dispatch = createEventDispatcher();
  const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL;
  const session = useSession();

  let email = "";
  let message = "";
  let loading = false;
  let dialog: HTMLDialogElement;

  onMount(() => {
    dialog.showModal();
  });

  $: if ($session.data?.user) {
    closeModal();
  }

  function closeModal() {
    dialog.close();
    dispatch("close");
  }

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
      message = "Check your email for the sign-in link ✉️";
    }
    loading = false;
  }
</script>

<dialog
  bind:this={dialog}
  on:click|self={closeModal}
  aria-labelledby="modal-title"
>
  <div class="modal-content">
    <button class="close-btn" on:click={closeModal} aria-label="Close">
      <i class="bi bi-x"></i>
    </button>

    <div class="header">
      <div class="brand-icon">
        <i class="bi bi-person-lock"></i>
      </div>
      <h2 id="modal-title">Sign in to Sisukas</h2>
      <p class="subtitle">Enter your email to receive a magic link</p>
    </div>

    <div class="form-group">
      <div class="input-wrapper">
        <i class="bi bi-envelope"></i>
        <input
          type="email"
          placeholder="you@aalto.fi"
          bind:value={email}
        />
      </div>

      <button class="submit-btn" on:click={handleMagicLink} disabled={loading || !email}>
        {#if loading}
          <span class="spinner"></span>
          Sending...
        {:else}
          <i class="bi bi-magic"></i>
          Send magic link
        {/if}
      </button>
    </div>

    {#if message}
      <div class="message" class:success={!message.includes('error')}>
        <i class="bi {message.includes('✉️') ? 'bi-check-circle' : 'bi-exclamation-circle'}"></i>
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
    color: #4a90e2;
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
    border-color: #4a90e2;
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
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
    background: #4a90e2;
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
    background: #fff5f5;
    color: #dc3545;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid #ffdede;
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