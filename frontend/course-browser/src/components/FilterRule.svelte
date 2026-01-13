<!-- src/components/FilterRule.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { formatRelationLabel } from '../domain/filters/helpers/RelationLabels';
  import { BLUEPRINT_ORDER } from '../domain/filters/config/BlueprintOrder';
  import { DefaultValueInitializer } from '../domain/filters/helpers/DefaultValueInitializer';
  import type { FilterConfig } from '../domain/filters/FilterTypes';
  import type { BaseRuleBlueprint } from '../domain/filters/blueprints/BaseRuleBlueprint';

  export let blueprints: Record<string, BaseRuleBlueprint>;
  export let config: FilterConfig;
  export let showBooleanOp: boolean = false;
  export let isActive: boolean = false;
  
  const dispatch = createEventDispatcher();
  
  $: blueprintKeys = blueprints 
    ? BLUEPRINT_ORDER.filter(key => key in blueprints)
    : [];
  
  $: blueprint = blueprints?.[config.blueprintKey];
  $: relations = blueprint?.validRelations || [];
  $: isPeriodField = config.blueprintKey === 'period';
  
  function handleFieldChange() {
    const newBlueprint = blueprints[config.blueprintKey];
    config.relation = newBlueprint.defaultRelation || newBlueprint.validRelations[0];
    config.value = DefaultValueInitializer.getDefaultValue(newBlueprint);
    dispatch('change');
    
    // If switching to period field, activate the period selector
    if (config.blueprintKey === 'period') {
      dispatch('periodActivate', config.id);
    }
  }
  
  function handlePeriodInputClick() {
    if (isPeriodField) {
      dispatch('periodActivate', config.id);
    }
  }
  
  $: needsValue = !['isEmpty', 'isNotEmpty'].includes(config.relation);

  let windowWidth = 0;
  $: booleanAndText = windowWidth <= 272 ? '&' : 'AND';
  $: booleanOrText = windowWidth <= 272 ? '/' : 'OR';

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      dispatch('search');
    }
  }
</script>

<svelte:window bind:innerWidth={windowWidth} />

<div class="filter-rule" class:period-active={isPeriodField && isActive}>
  {#if showBooleanOp}
    <select class="filter-boolean" bind:value={config.booleanOp} on:change={() => dispatch('change')}>
      <option value="AND">{booleanAndText}</option>
      <option value="OR">{booleanOrText}</option>
    </select>
  {/if}

  <select class="filter-field" bind:value={config.blueprintKey} on:change={handleFieldChange}>
    {#each blueprintKeys as key (key)}
      <option value={key}>{blueprints[key].label}</option>
    {/each}
  </select>
  
  <select class="filter-relation" bind:value={config.relation} on:change={() => dispatch('change')}>
    {#each relations as relation (relation)}
      <option value={relation}>{formatRelationLabel(relation)}</option>
    {/each}
  </select>
  
  {#if needsValue}
    <div class="filter-input">
      {#if blueprint?.builderType === 'period'}
        <input 
          type="text" 
          class="filter-value" 
          value={config.value}
          placeholder="Select period(s)"
          readonly
          on:click={handlePeriodInputClick}
          on:focus={handlePeriodInputClick}
        />
      {:else if blueprint?.builderType === 'text'}
        <input 
          type="text" 
          class="filter-value" 
          bind:value={config.value} 
          on:input={() => dispatch('change')} 
          on:keydown={handleKeyDown}
          placeholder="Enter value" 
        />
      {:else if blueprint?.builderType === 'numeric' || blueprint?.builderType === 'numericRange'}
        <input 
          type="number" 
          class="filter-value" 
          bind:value={config.value} 
          on:input={() => dispatch('change')}
          on:keydown={handleKeyDown}
          placeholder="Enter value" 
        />
      {:else if blueprint?.builderType === 'date' || blueprint?.builderType === 'dateRange'}
        <input 
          type="date" 
          class="filter-value" 
          bind:value={config.value} 
          on:change={() => dispatch('change')}
          on:keydown={handleKeyDown}
        />
      {:else if blueprint?.builderType === 'categorical'}
        {#if blueprint.validValues && blueprint.validValues.length > 0}
          <select class="filter-value" bind:value={config.value} on:change={() => dispatch('change')}>
            {#each blueprint.validValues as val (val)}
              <option value={val}>{blueprint.valueLabels?.[val] || val}</option>
            {/each}
          </select>
        {:else}
          <input 
            type="text" 
            class="filter-value" 
            bind:value={config.value} 
            on:input={() => dispatch('change')}
            on:keydown={handleKeyDown}
            placeholder="Enter value" 
          />
        {/if}
      {:else if blueprint?.builderType === 'membership'}
        <select class="filter-value" bind:value={config.value} on:change={() => dispatch('change')}>
          {#each blueprint.availableSets || [] as id (id)}
            <option value={id}>{blueprint.getSetLabel?.(id) || id}</option>
          {/each}
        </select>
      {/if}
    </div>
  {/if}
  
  <button
    class="delete-btn"
    on:click={() => dispatch('remove')}
    aria-label="Remove filter rule"
    title="Remove filter rule"
  >
    <i class="bi bi-trash" aria-hidden="true"></i>
  </button>
</div>

<style>
  .filter-rule {
    margin-bottom: 0.3em;
    position: relative;
  }
  
  .filter-rule.period-active {
    background: #ffeeee;
  }

  .filter-boolean {
    position: absolute;
  }
  
  .filter-input, button, select, input {
    display: inline-block;
    background-color: #fff;
    appearance: none;
    font-size: 1em;
    cursor: pointer;
    height: 2.7em;
    vertical-align: middle;
    text-align: start;
  }

  button, select, .filter-input {
    margin: 0 0.1em;
  }

  button, select, input {
    box-sizing: border-box;
    box-shadow: 0 2px 5px rgb(0 0 0 / 10%);
    border: 1px solid #ddd;
    border-radius: 4px;
    padding-left: 0.7em;
    padding-right: 0.7em;
  }

  input[type="date"] {
    align-items: center;
    display: inline-flex;
  }

  .filter-field {
    margin-left: 4.3em;
    width: 20%;
    max-width: 150px;
    min-width: 80px;
  }
  
  .filter-relation {
    width: 18%;
    max-width: 200px;
    min-width: 80px;
  }
  
  .filter-input {
    width: 30%;
    max-width: 320px;
    min-width: 100px;
  }
  
  .filter-value {
    width: 100%;
    box-sizing: border-box;
  }
  
  .delete-btn {
    color: #d9534f;
  }
  
  .delete-btn:hover {
    background-color: #d9534f;
    color: white;
  }

  /* Adjust widths for smaller screens */
  @media (max-width: 768px) {
    .filter-field {
      width: 20%;
      max-width: 154px;
    }
    
    .filter-relation {
      width: 18%;
      max-width: 138px;
    }
    
    .filter-input {
      width: 30%;
      max-width: 230px;
    }
  }

  @media (max-width: 540px) {
    .filter-field {
      width: 20%;
      max-width: 100px;
      min-width: 40px;
    }
    
    .filter-relation {
      width: 18%;
      max-width: 120px;
      min-width: 36px;
    }
    
    .filter-input {
      width: 30%;
      max-width: 150px;
      min-width: 60px;
    }
  }

  /* Adjust widths for very narrow screens */
  @media (max-width: 272px) {
    .filter-rule {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3em;
      font-size: 0.8em;
    }

    .filter-boolean {
      width: calc(10%);
    }

    .filter-field {
      margin-left: calc(10% + 0.6em);
      width: calc(20%);
      max-width: none;
    }

    .filter-relation {
      width: calc(18%);
      max-width: none;
    }

    .filter-input {
      width: calc(28%);
      max-width: none;
    }
  }
</style>