<!-- src/components/FilterContainer.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import FilterRule from './FilterRule.svelte';
  import PeriodSelector from './PeriodSelector.svelte';
  import { getBuilderFor } from '../domain/filters/builders/getBuilderFor';
  import { ValueParser } from '../domain/filters/helpers/ValueParser';
  import { DefaultValueInitializer } from '../domain/filters/helpers/DefaultValueInitializer';
  import type { FilterConfig, FilterRuleGroups } from '../domain/filters/FilterTypes';
  import type { Course } from '../domain/models/Course';
  import type { AcademicPeriod } from '../domain/models/AcademicPeriod';
  import type { FilterRule as Rule } from '../domain/filters/core/FilterRule';
  import type { BaseRuleBlueprint } from '../domain/filters/blueprints/BaseRuleBlueprint';

  interface FilterRuleBuilder {
    isComplete(): boolean;
    build(): Rule<Course>;
    setRelation?(relation: string): void;
    setValue?(value: unknown): void;
    setIdentifier?(identifier: string): void;
  }
  
  export let blueprints: Record<string, BaseRuleBlueprint>;
  export let filterRules: FilterRuleGroups = [];
  export let periods: AcademicPeriod[] = [];
  
  const dispatch = createEventDispatcher();
  
  let filterConfigs: FilterConfig[] = [];
  let nextId = 0;

  // Period selector state
  let activePeriodRuleId: number | null = null;
  $: showPeriodSelector = activePeriodRuleId !== null;
  $: activePeriodConfig = filterConfigs.find(c => c.id === activePeriodRuleId);
  $: selectedPeriods = activePeriodConfig && typeof activePeriodConfig.value === 'string'
    ? activePeriodConfig.value.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  
  function handlePeriodRuleActivate(event: CustomEvent<number>) {
    activePeriodRuleId = event.detail;
  }
  
  function handlePeriodSelectionChange(event: CustomEvent<string[]>) {
    if (activePeriodRuleId !== null) {
      const configIndex = filterConfigs.findIndex(c => c.id === activePeriodRuleId);
      if (configIndex !== -1) {
        filterConfigs[configIndex].value = event.detail.join(', ');
        filterConfigs = [...filterConfigs]; // Force reactivity
        updateFilterRules();
      }
    }
  }
  
  function handlePeriodSelectorClose() {
    activePeriodRuleId = null;
  }

  // Public method to get current filter configs (for serialization)
  export function getFilterConfigs(): FilterConfig[] {
    return filterConfigs;
  }
  
  // Public method to load filter configs (for deserialization)
  export function loadFilterConfigs(configs: FilterConfig[]) {
    // Reset nextId based on loaded configs
    nextId = configs.length > 0 
      ? Math.max(...configs.map(c => c.id)) + 1 
      : 0;
    
    filterConfigs = configs;
    updateFilterRules();
  }
  
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
      value: DefaultValueInitializer.getDefaultValue(firstBlueprint),
      booleanOp: 'AND'
    }];
  }
  
  function removeFilterRule(id: number) {
    filterConfigs = filterConfigs.filter(f => f.id !== id);
    // Handle period selector when the active rule is removed
    if (activePeriodRuleId === id) {
      // Look for another period rule to activate
      const periodRules = filterConfigs.filter(f => blueprints[f.blueprintKey]?.builderType === 'period');
      activePeriodRuleId = periodRules.length > 0 ? periodRules[0].id : null;
    }
    updateFilterRules();
  }
  
  function updateFilterRules() {
    if (!blueprints) return;
    
    // Build filter groups (OR groups containing AND rules)
    const groups: FilterRuleGroups = [];
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

      let builder: FilterRuleBuilder;
      
      switch (blueprint.builderType) {
        case 'text':
        case 'numeric':
        case 'numericRange':
        case 'date':
        case 'dateRange':
        case 'categorical':
        case 'membership':
        case 'period':
          builder = getBuilderFor(blueprint as never) as FilterRuleBuilder;
          break;
        default: {
          const _exhaustive: never = blueprint.builderType;
          throw new Error(`Unknown blueprint type: ${_exhaustive}`);
        }
      }
      
      if (builder.setRelation) {
        builder.setRelation(relation);
      }
      
      // Parse the value using ValueParser
      const parsedValue = ValueParser.parse(blueprint, relation, value);

      if (parsedValue !== undefined) {
        if (builder.setValue) {
          builder.setValue(parsedValue);
        } else if (builder.setIdentifier) {
          builder.setIdentifier(parsedValue as string);
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

  function handleFilterSearch() {
    dispatch('search');
  }
</script>

<PeriodSelector 
  {periods}
  {selectedPeriods}
  visible={showPeriodSelector}
  on:change={handlePeriodSelectionChange}
  on:close={handlePeriodSelectorClose}
/>

<div class="filter-container">
  {#if blueprints}
    {#each filterConfigs as config, index (config.id)}
      <FilterRule
        {blueprints}
        {config}
        showBooleanOp={index > 0}
        isActive={config.id === activePeriodRuleId}
        on:change={updateFilterRules}
        on:remove={() => removeFilterRule(config.id)}
        on:periodActivate={handlePeriodRuleActivate}
        on:search={handleFilterSearch}
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
  :root {
    --primary: #4a90e2;
    --primary-hover: #2980f1;
    --bg: #f8fafc;
    --card-bg: #ffffff;
    --text-main: #1e293b;
    --text-muted: #64748b;
    --border: #e2e8f0;
  }

  .filter-container {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.75rem 1rem;
    background: var(--card-bg);
    min-height: 100px;
  }
  
  .empty-state {
    text-align: center;
    padding: 2rem;
    background: var(--bg);
    border: 2px dashed var(--border);
    border-radius: 8px;
    color: var(--text-muted);
  }

  .empty-state p {
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.4;
  }
</style>