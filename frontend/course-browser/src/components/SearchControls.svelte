<!-- src/components/SearchControls.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let showUnique: boolean = false;
  export let source: "active" | "historical" = "active";
  
  const dispatch = createEventDispatcher();

  function toggleSource() {
    const next = source === "active" ? "historical" : "active";
    source = next;
    dispatch("sourceChange", { source: next });
  }
</script>

<div id="search-container">
  <div class="button-group">
    <button on:click={() => dispatch('addRule')}>
      <i class="bi bi-plus-circle"></i>
      <span class="button-text">Add Rule</span>
    </button>
    
    <button on:click={() => dispatch('search')} class="primary">
      <i class="bi bi-search"></i>
      <span class="button-text">Search</span>
    </button>
  </div>

  <div class="options-group">
    <label class="switch">
      <input type="checkbox" id="uniqueToggle" bind:checked={showUnique} on:change={() => dispatch('search')} />
      <span class="slider"></span>
    </label>
    <span class="toggle-label">Unique</span>

    <!-- Single Active / Historical toggle -->
    <button
      class="toggle-source"
      on:click={toggleSource}
      title="Toggle dataset"
    >
      <i class="bi bi-database"></i>
      <span class="button-text">
        {source === "active" ? "See Older" : "See Active"}
      </span>
    </button>
    
    <button on:click={() => dispatch('save')}>
      <i class="bi bi-floppy"></i>
      <span class="button-text">Save</span>
    </button>
    
    <button on:click={() => dispatch('load')}>
      <i class="bi bi-folder"></i>
      <span class="button-text">Load</span>
    </button>
  </div>
</div>

<style>
  #search-container {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5em;
    padding-left: 1.7%;
    padding-bottom: 12px;
  }

  .button-group,
  .options-group {
    display: flex;
    align-items: center;
    gap: 0.3em;
    flex-wrap: wrap;
  }
  
  button {
    display: inline-flex;
    align-items: center;
    gap: 0.3em;
    background-color: #fff;
    font-size: 1em;
    cursor: pointer;
    height: 2.7em;
    box-sizing: border-box;
    box-shadow: 0 2px 5px rgb(0 0 0 / 10%);
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 0 0.7em;
  }
  
  button:active, button:focus {
    border-color: #4a90e2;
    box-shadow: 0 0 5px rgb(74 144 226 / 50%);
    outline: none;
  }
  
  button:hover {
    background: #f0f0f0;
  }
  
  button.primary {
    background: #4a90e2;
    color: white;
    border-color: #08D;
  }
  
  button.primary:hover {
    background: #357abd;
  }

  button.primary:active, button.primary:focus {
    border-color: #357abd;
    box-shadow: 0 0 5px rgb(53 122 189 / 50%);
  }
  
  .switch {
    position: relative;
    display: inline-block;
    width: 40px;
    height: 20px;
    vertical-align: middle;
    flex-shrink: 0;
  }
  
  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    background-color: #ccc;
    transition: .4s;
    border-radius: 20px;
  }
  
  .slider::before {
    position: absolute;
    content: "";
    height: 14px;
    width: 14px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: .4s;
    border-radius: 50%;
  }
  
  input:checked + .slider {
    background-color: #4caf50;
  }
  
  input:checked + .slider::before {
    transform: translateX(20px);
  }
  
  .toggle-label {
    font-size: 0.9em;
    cursor: pointer;
    white-space: nowrap;
  }

  /* Mobile responsive - hide button text on narrow screens */
  @media (max-width: 330px) {
    #search-container {
      padding-left: 2%;
      padding-right: 2%;
    }

    .button-text {
      display: none;
    }

    button {
      min-width: 2.7em;
      justify-content: center;
      padding: 0 0.5em;
    }

    .toggle-label {
      font-size: 0.85em;
    }
  }
</style>