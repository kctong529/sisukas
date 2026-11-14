// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import SearchControls from '../../../src/components/filters/SearchControls.svelte';

const components: Array<ReturnType<typeof mount>> = [];

function render(): HTMLElement {
  const target = document.createElement('div');
  document.body.appendChild(target);
  components.push(mount(SearchControls, { target }));
  flushSync();
  return target;
}

afterEach(async () => {
  for (const component of components.splice(0)) {
    await unmount(component);
  }
  document.body.replaceChildren();
});

describe('SearchControls shared button styling', () => {
  it('uses shared variants for all toolbar actions', () => {
    const target = render();
    const buttons = [...target.querySelectorAll('button')];

    expect(buttons).toHaveLength(5);
    expect(buttons.every(button => button.classList.contains('ui-button'))).toBe(true);
    expect(buttons.find(button => button.getAttribute('aria-label') === 'Search')
      ?.classList.contains('ui-button--primary')).toBe(true);
    expect(buttons.filter(button => button.getAttribute('aria-label') !== 'Search')
      .every(button => button.classList.contains('ui-button--secondary'))).toBe(true);
  });

  it('reflects the See Older toggle with aria-pressed and its accessible name', () => {
    const target = render();
    const toggle = target.querySelector<HTMLButtonElement>('button[aria-pressed]');

    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
    expect(toggle?.getAttribute('aria-label')).toBe('See Older');

    toggle?.click();
    flushSync();

    expect(toggle?.getAttribute('aria-pressed')).toBe('true');
    expect(toggle?.getAttribute('aria-label')).toBe('See Active');
  });
});
