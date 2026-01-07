<!-- src/components/SearchControls.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let showUnique: boolean = false;
  
  const dispatch = createEventDispatcher();
</script>

<div id="search-container">
  <button on:click={() => dispatch('addRule')}>
    <i class="bi bi-plus-circle"></i> Add Rule
  </button>
  
  <button on:click={() => dispatch('search')} class="primary">
    <i class="bi bi-search"></i> Search
  </button>
  
  <label class="switch">
    <input type="checkbox" id="uniqueToggle" bind:checked={showUnique} on:change={() => dispatch('search')} />
    <span class="slider"></span>
  </label>
  <span class="toggle-label">Unique Only</span>
  
  <button on:click={() => dispatch('save')}>
    <i class="bi bi-floppy"></i> Save
  </button>
  
  <button on:click={() => dispatch('load')}>
    <i class="bi bi-folder-open"></i> Load
  </button>
</div>

<style>
  #search-container {
    display: flex;
    align-items: center;
    gap: 0.1em;
    padding-left: 1.7%;
    padding-bottom: 12px;
  }
  
  button {
    display: inline-block;
    background-color: #fff;
    font-size: 1em;
    cursor: pointer;
    height: 2.7em;
    vertical-align: middle;
    box-sizing: border-box;
    box-shadow: 0 2px 5px rgb(0 0 0 / 10%);
    border: 1px solid #ddd;
    border-radius: 4px;
    padding-left: 0.7em;
    padding-right: 0.7em;
    margin: 0 0.1em;
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
    border-color: #4a90e2;
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
    margin-left: 10px;
    vertical-align: middle;
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
    margin-left: 2px;
    font-size: 1em;
    cursor: pointer;
    vertical-align: middle;
    text-align: start;
  }
</style>