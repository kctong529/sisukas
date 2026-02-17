<!-- src/components/SearchControls.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let showUnique: boolean = false;
  export let source: "active" | "all" = "active";
  
  const dispatch = createEventDispatcher();

  function toggleSource() {
    const next = source === "active" ? "all" : "active";
    source = next;
    dispatch("sourceChange", { source: next });
  }
</script>

<div class="search-controls">
  <div class="button-group">
    <button class="btn btn-secondary" on:click={() => dispatch('addRule')} title="Add a new search rule">
      <i class="bi bi-plus-circle"></i>
      <span class="button-text">Add Rule</span>
    </button>
    
    <button class="btn btn-primary" on:click={() => dispatch('search')} title="Execute search">
      <i class="bi bi-search"></i>
      <span class="button-text">Search</span>
    </button>
  </div>

  <div class="options-group">
    <label class="checkbox-wrapper">
      <input type="checkbox" id="uniqueToggle" bind:checked={showUnique} on:change={() => dispatch('search')} />
      <span class="checkbox-label">Unique</span>
    </label>

    <button
      class="btn btn-secondary"
      on:click={toggleSource}
      class:active={source === "all"}
      aria-pressed={source === "all"}
      title={source === "all" ? 'Showing historical course instances' : 'Showing active course instances'}
    >
      <i class="bi bi-database"></i>
      <span class="button-text">
        {source === "active" ? "See Older" : "See Active"}
      </span>
    </button>
    
    <button class="btn btn-secondary" on:click={() => dispatch('save')} title="Save current search">
      <i class="bi bi-floppy"></i>
      <span class="button-text">Save</span>
    </button>
    
    <button class="btn btn-secondary" on:click={() => dispatch('load')} title="Load a saved search">
      <i class="bi bi-folder"></i>
      <span class="button-text">Load</span>
    </button>
  </div>
</div>

<style>
  :root {
    --primary: #2f7fd6;
    --primary-hover: #2980f1;
    --bg: #f8fafc;
    --card-bg: #ffffff;
    --text-main: #1e293b;
    --text-muted: #64748b;
    --border: #e2e8f0;
  }

  .search-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--card-bg);
  }

  .button-group,
  .options-group {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    flex-wrap: wrap;
  }

  /* Base button styles */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.4rem 0.6rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 500;
    transition: all 0.2s;
    height: 32.5px;
    box-sizing: border-box;
    white-space: nowrap;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Primary button */
  .btn-primary {
    background: var(--primary);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--primary-hover);
  }

  .btn-primary:focus:not(:disabled) {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  /* Secondary button */
  .btn-secondary {
    background: var(--card-bg);
    color: var(--text-main);
    border: 1px solid var(--border);
  }

  .btn-secondary:hover:not(:disabled) {
    border-color: var(--primary);
    background: #f8fafc;
  }

  .btn-secondary:focus:not(:disabled) {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
  }

  .btn-secondary.active {
    background: #e3f2fd;
    border-color: var(--primary);
    color: var(--primary);
  }

  /* Icon styling */
  .btn i {
    font-size: 0.9rem;
  }

  .button-text {
    display: inline;
  }

  /* Checkbox wrapper */
  .checkbox-wrapper {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
    user-select: none;
  }

  .checkbox-wrapper input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--primary);
  }

  .checkbox-wrapper input[type="checkbox"]:focus {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  .checkbox-label {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--text-main);
  }

  /* Responsive behavior */
  @media (max-width: 600px) {
    .search-controls {
      gap: 0.3rem;
      padding: 0.5rem 0.75rem;
    }

    .btn {
      padding: 0.4rem 0.5rem;
    }
  }

  @media (max-width: 600px) {
    .button-text {
      display: none;
    }

    .btn {
      min-width: 32.5px;
      padding: 0;
      justify-content: center;
    }

    .checkbox-label {
      display: none;
    }

    .checkbox-wrapper {
      gap: 0;
    }
  }
</style>
