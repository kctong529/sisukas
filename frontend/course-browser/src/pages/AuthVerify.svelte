<!-- src/pages/AuthVerify.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import { authClient } from "../lib/authClient";

  let token = "";
  let loading = false;
  let errorMsg = "";
  let status = "ready"; // ready, loading, success, error

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    token = params.get("token") || "";
    
    if (!token) {
      errorMsg = "No verification token found in the URL.";
    }
  });

  async function handleVerify() {
    status = "loading";
    const { error } = await authClient.magicLink.verify({
      query: { token, callbackURL: "/" }
    });

    if (error && error.message) {
      errorMsg = error.message;
      status = "error";
    } else {
      status = "success";
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    }
  }
</script>

<main class="verify-page">
  <div class="card">
    <h1>Verify your email</h1>
    <p>Please click the button below to complete your sign-in to Sisukas.</p>

    {#if errorMsg}
      <div class="error-banner">
        <i class="bi bi-exclamation-triangle"></i>
        {errorMsg}
      </div>
    {/if}

    <button 
      on:click={handleVerify} 
      disabled={status === "loading" || status === "success"}
      class="verify-btn"
    >
      {#if loading}
        Verifying...
      {:else if status === "success"}
        Success! Redirecting...
      {:else}
        Sign In Now
      {/if}
    </button>
  </div>
</main>

<style>
  .verify-page {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background: #f8f9fa;
  }
  .card {
    background: white;
    padding: 2.5rem;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    text-align: center;
    max-width: 400px;
  }
  .verify-btn {
    background: #2f7fd6;
    color: white;
    border: none;
    padding: 0.8rem 2rem;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    margin-top: 1rem;
  }
  .verify-btn:disabled {
    background: #ccc;
  }
  .error-banner {
    color: #d9534f;
    background: #fff5f5;
    padding: 0.75rem;
    border-radius: 6px;
    margin-bottom: 1rem;
  }
</style>