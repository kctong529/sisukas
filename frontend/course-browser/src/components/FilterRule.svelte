<!-- src/components/FilterRule.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { formatRelationLabel } from '../domain/filters/helpers/RelationLabels';
  import { BLUEPRINT_ORDER } from '../domain/filters/config/BlueprintOrder';
  import { DefaultValueInitializer } from '../domain/filters/helpers/DefaultValueInitializer';
  import PeriodSelector from './PeriodSelector.svelte';
  import type { FilterConfig } from '../domain/filters/FilterTypes';
  import type { AcademicPeriod } from '../domain/models/AcademicPeriod';
  
  export let blueprints: any;
  export let config: FilterConfig;
  export let showBooleanOp: boolean = false;
  export let periods: AcademicPeriod[] = [];
  
  const dispatch = createEventDispatcher();
  
  // Sort blueprint keys by custom order
  $: blueprintKeys = blueprints 
    ? BLUEPRINT_ORDER.filter(key => key in blueprints)
    : [];
  
  $: blueprint = blueprints?.[config.blueprintKey];
  $: relations = blueprint?.validRelations || [];

  $: showPeriodSelector = config.blueprintKey === 'period';

  // Parse period IDs from value string
  $: selectedPeriods = typeof config.value === 'string' 
    ? config.value.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  
  function handleFieldChange() {
    // Reset relation and value when field changes
    const newBlueprint = blueprints[config.blueprintKey];
    config.relation = newBlueprint.defaultRelation || newBlueprint.validRelations[0];
    config.value = DefaultValueInitializer.getDefaultValue(newBlueprint);
    dispatch('change');
  }

  function handlePeriodSelectionChange(event: CustomEvent<string[]>) {
    const periodIds = event.detail;
    config.value = periodIds.join(', ');
    dispatch('change');
  }
  
  $: needsValue = !['isEmpty', 'isNotEmpty'].includes(config.relation);
</script>

<div class="filter-rule">
  {#if showBooleanOp}
    <select class="filter-boolean" bind:value={config.booleanOp} on:change={() => dispatch('change')}>
      <option value="AND">AND</option>
      <option value="OR">OR</option>
    </select>
  {/if}
  
  <select class="filter-field" bind:value={config.blueprintKey} on:change={handleFieldChange}>
    {#each blueprintKeys as key}
      <option value={key}>{blueprints[key].label}</option>
    {/each}
  </select>
  
  <select class="filter-relation" bind:value={config.relation} on:change={() => dispatch('change')}>
    {#each relations as relation}
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
        />
      {:else if blueprint?.builderType === 'text'}
        <input type="text" class="filter-value" bind:value={config.value} on:input={() => dispatch('change')} placeholder="Enter value" />
      {:else if blueprint?.builderType === 'numeric' || blueprint?.builderType === 'numericRange'}
        <input type="number" class="filter-value" bind:value={config.value} on:input={() => dispatch('change')} placeholder="Enter value" />
      {:else if blueprint?.builderType === 'date' || blueprint?.builderType === 'dateRange'}
        <input type="date" class="filter-value" bind:value={config.value} on:change={() => dispatch('change')} />
      {:else if blueprint?.builderType === 'categorical'}
        {#if blueprint.validValues && blueprint.validValues.length > 0}
          <select class="filter-value" bind:value={config.value} on:change={() => dispatch('change')}>
            {#each blueprint.validValues as val}
              <option value={val}>{blueprint.valueLabels?.[val] || val}</option>
            {/each}
          </select>
        {:else}
          <input type="text" class="filter-value" bind:value={config.value} on:input={() => dispatch('change')} placeholder="Enter value" />
        {/if}
      {:else if blueprint?.builderType === 'membership'}
        <select class="filter-value" bind:value={config.value} on:change={() => dispatch('change')}>
          {#each blueprint.availableSets as id}
            <option value={id}>{blueprint.getSetLabel(id)}</option>
          {/each}
        </select>
      {/if}
    </div>
  {/if}
  
  <button on:click={() => dispatch('remove')}><i class="bi bi-trash"></i></button>
</div>

{#if showPeriodSelector}
  <PeriodSelector 
    {periods} 
    {selectedPeriods}
    visible={showPeriodSelector}
    on:change={handlePeriodSelectionChange}
  />
{/if}

<style>
  .filter-boolean {
    position: absolute;
  }
  
  .filter-input, button, select, input{
      display: inline-block;
      background-color: #fff;
      appearance: none;
      font-size: 1em;
      cursor: pointer;
      height: 2.7em;
      vertical-align: middle;
      text-align: start; /* Align text consistently */
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
    max-width: 120px;
    min-width: 80px;
  }
  
  .filter-relation {
    max-width: 308px;
    min-width: 80px;
    width: 26%;
  }
  
  .filter-input {
    max-width: 320px;
    min-width: 120px;
    width: 20%;
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
</style>