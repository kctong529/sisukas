<!-- src/components/filters/SearchControls.svelte -->
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
    <button
      class="ui-button ui-button--secondary search-button"
      on:click={() => dispatch('addRule')}
      aria-label="Add Rule"
      title="Add a new search rule"
    >
      <i class="bi bi-plus-circle" aria-hidden="true"></i>
      <span class="button-text">Add Rule</span>
    </button>
    
    <button
      class="ui-button ui-button--primary search-button"
      on:click={() => dispatch('search')}
      aria-label="Search"
      title="Execute search"
    >
      <i class="bi bi-search" aria-hidden="true"></i>
      <span class="button-text">Search</span>
    </button>
  </div>

  <div class="options-group">
    <label class="checkbox-wrapper">
      <input
        type="checkbox"
        id="uniqueToggle"
        bind:checked={showUnique}
        aria-label="Unique courses"
        on:change={() => dispatch('search')}
      />
      <span class="checkbox-label">Unique</span>
    </label>

    <button
      class="ui-button ui-button--secondary search-button"
      on:click={toggleSource}
      aria-label={source === 'active' ? 'See Older' : 'See Active'}
      aria-pressed={source === "all"}
      title={source === "all" ? 'Showing historical course instances' : 'Showing active course instances'}
    >
      <i class="bi bi-database" aria-hidden="true"></i>
      <span class="button-text">
        {source === "active" ? "See Older" : "See Active"}
      </span>
    </button>
    
    <button
      class="ui-button ui-button--secondary search-button"
      on:click={() => dispatch('save')}
      aria-label="Save"
      title="Save current search"
    >
      <i class="bi bi-floppy" aria-hidden="true"></i>
      <span class="button-text">Save</span>
    </button>

    <button
      class="ui-button ui-button--secondary search-button"
      on:click={() => dispatch('load')}
      aria-label="Load"
      title="Load a saved search"
    >
      <i class="bi bi-folder" aria-hidden="true"></i>
      <span class="button-text">Load</span>
    </button>
  </div>
</div>

<style>
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

  /* Retain the original compact toolbar spacing; appearance is shared. */
  .search-button {
    gap: 0.4rem;
    padding: 0.4rem 0.6rem;
  }

  /* Icon styling */
  .search-button i {
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

    .search-button {
      padding: 0.4rem 0.5rem;
    }
  }

  @media (max-width: 600px) {
    .button-text {
      display: none;
    }

    .search-button {
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
