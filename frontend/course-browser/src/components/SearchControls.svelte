<!-- src/components/SearchControls.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let showUnique: boolean = false;
  
  const dispatch = createEventDispatcher();
</script>

<div id="search-container">
  <div id="searchGroup">
    <button on:click={() => dispatch('addRule')}>
      ➕ Add Rule
    </button>
    
    <button on:click={() => dispatch('search')} class="primary">
      🔍 Search
    </button>
    
    <label class="switch">
      <input type="checkbox" bind:checked={showUnique} on:change={() => dispatch('search')} />
      <span class="slider round"></span>
    </label>
    <span class="toggle-label">Unique Only</span>
    
    <button on:click={() => dispatch('save')}>
      💾 Save
    </button>
    
    <button on:click={() => dispatch('load')}>
      📂 Load
    </button>
  </div>
</div>

<style>
  #search-container {
    margin: 1rem 0;
  }
  
  #searchGroup {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
  }
  
  button {
    padding: 0.6rem 1.2rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s;
  }
  
  button:hover {
    background: #f0f0f0;
  }
  
  button.primary {
    background: #007bff;
    color: white;
    border-color: #007bff;
  }
  
  button.primary:hover {
    background: #0056b3;
  }
  
  .switch {
    position: relative;
    display: inline-block;
    width: 50px;
    height: 24px;
  }
  
  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    transition: 0.4s;
  }
  
  .slider.round {
    border-radius: 24px;
  }
  
  .slider.round:before {
    border-radius: 50%;
  }
  
  .slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.4s;
  }
  
  input:checked + .slider {
    background-color: #007bff;
  }
  
  input:checked + .slider:before {
    transform: translateX(26px);
  }
  
  .toggle-label {
    font-size: 0.9rem;
    margin-left: 0.5rem;
  }
</style>