<!-- src/components/FilterContainer.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import FilterRule from './FilterRule.svelte';
  import { getBuilderFor } from '../domain/filters/builder/getBuilderFor';
  import { ValueParser } from '../domain/filters/utils/ValueParser';
  import type { FilterRule as Rule } from '../domain/filters/core/FilterRule';
  import type { Course } from '../domain/models/Course';
  
  export let blueprints: any;
  export let filterRules: Rule<Course>[][] = [];
  
  const dispatch = createEventDispatcher();
  
  interface FilterConfig {
    id: number;
    blueprintKey: string;
    relation: string;
    value: any;
    booleanOp: 'AND' | 'OR';
  }
  
  let filterConfigs: FilterConfig[] = [];
  let nextId = 0;
  
  export function addFilterRule() {
    if (!blueprints) {
      console.warn("Blueprints not loaded yet");
      return;
    }
    
    const firstBlueprintKey = Object.keys(blueprints)[0];
    const firstBlueprint = blueprints[firstBlueprintKey];
    
    filterConfigs = [...filterConfigs, {
      id: nextId++,
      blueprintKey: firstBlueprintKey,
      relation: firstBlueprint.defaultRelation || firstBlueprint.validRelations[0],
      value: '',
      booleanOp: 'AND'
    }];
  }
  
  function removeFilterRule(id: number) {
    filterConfigs = filterConfigs.filter(f => f.id !== id);
    updateFilterRules();
  }
  
  function updateFilterRules() {
    if (!blueprints) return;
    
    // Build filter groups (OR groups containing AND rules)
    const groups: Rule<Course>[][] = [];
    let currentGroup: Rule<Course>[] = [];
    
    filterConfigs.forEach((config, index) => {
      const rule = buildRule(config);
      if (!rule) return;
      
      if (index > 0 && config.booleanOp === 'OR') {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [rule];
      } else {
        currentGroup.push(rule);
      }
    });
    
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    filterRules = groups;
  }
  
  function buildRule(config: FilterConfig): Rule<Course> | null {
    try {
      const { blueprintKey, relation, value } = config;
      const blueprint = blueprints[blueprintKey];
      
      if (!blueprint) {
        console.warn(`Blueprint not found: ${blueprintKey}`);
        return null;
      }
      
      if (!blueprint.validRelations.includes(relation)) {
        console.warn(`Invalid relation "${relation}" for blueprint "${blueprintKey}"`);
        return null;
      }
      const builder = getBuilderFor(blueprint);
      (builder as any).setRelation(relation);
      
      // Parse the value using ValueParser
      const parsedValue = ValueParser.parse(blueprint, relation, value);
      
      if (parsedValue !== undefined) {
        if ('setValue' in builder) {
          (builder as any).setValue(parsedValue);
        } else if ('setIdentifier' in builder) {
          (builder as any).setIdentifier(parsedValue);
        }
      }
      
      if (!builder.isComplete()) {
        console.warn(`Incomplete builder for ${blueprintKey}`);
        return null;
      }

      return builder.build();
    } catch (error) {
      console.error('Failed to build rule:', error);
      return null;
    }
  }

  $: if (filterConfigs.length > 0 && blueprints) {
    updateFilterRules();
  }
</script>

<div id="filter-container">
  {#if blueprints}
    {#each filterConfigs as config, index (config.id)}
      <FilterRule
        {blueprints}
        {config}
        showBooleanOp={index > 0}
        on:change={updateFilterRules}
        on:remove={() => removeFilterRule(config.id)}
      />
    {/each}
    
    {#if filterConfigs.length === 0}
      <div class="empty-state">
        <p>No filters added. Click "Add Rule" to start filtering.</p>
      </div>
    {/if}
  {:else}
    <div class="empty-state">
      <p>Loading filter options...</p>
    </div>
  {/if}
</div>

<style>
  #filter-container {
    display: flex;
    flex-direction: column;
    /* margin: 2rem 0; */
    min-height: 100px;
    padding: 1.7%;
    padding-bottom: 12px;
  }
  
  .empty-state {
    text-align: center;
    padding: 2rem;
    color: #666;
    border: 2px dashed #ddd;
    border-radius: 8px;
  }
</style>