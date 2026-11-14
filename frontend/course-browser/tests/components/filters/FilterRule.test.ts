// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import FilterRule from '../../../src/components/filters/FilterRule.svelte';

import type { BaseRuleBlueprint } from '../../../src/domain/filters/blueprints/BaseRuleBlueprint';
import type { FilterConfig } from '../../../src/domain/filters/FilterTypes';

const instances: Array<ReturnType<typeof mount>> = [];

function render() {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const config: FilterConfig = {
    id: 1,
    blueprintKey: 'name',
    relation: 'contains',
    value: 'robotics',
    booleanOp: 'AND',
  };
  const blueprints = {
    name: {
      builderType: 'text',
      field: 'name',
      label: 'Course name',
      validRelations: ['contains'],
      defaultRelation: 'contains',
    },
  } satisfies Record<string, BaseRuleBlueprint>;
  const instance = mount(FilterRule, {
    target,
    props: { blueprints, config, showBooleanOp: true },
  });
  instances.push(instance);
  flushSync();
  return { target, instance };
}

afterEach(async () => {
  for (const instance of instances.splice(0)) await unmount(instance);
  document.body.replaceChildren();
});

describe('FilterRule shared styling', () => {
  it('uses the shared secondary button for removal without changing the filter fields', () => {
    const { target } = render();
    const remove = target.querySelector<HTMLButtonElement>('button[aria-label="Remove filter rule"]');

    expect(remove?.classList.contains('ui-button')).toBe(true);
    expect(remove?.classList.contains('ui-button--secondary')).toBe(true);
    expect(target.querySelectorAll('select')).toHaveLength(3);
    expect(target.querySelector('input[type="text"]')).not.toBeNull();
  });

  it('preserves the compact selector and value control classes', () => {
    const { target } = render();
    expect(target.querySelector('select.filter-boolean')).not.toBeNull();
    expect(target.querySelector('select.filter-field')).not.toBeNull();
    expect(target.querySelector('select.filter-relation')).not.toBeNull();
    expect(target.querySelector('input.filter-value')).not.toBeNull();
  });
});
