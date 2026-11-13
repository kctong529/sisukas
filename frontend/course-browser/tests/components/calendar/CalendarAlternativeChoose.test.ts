// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import CalendarGroupAlternatives from '../../../src/components/calendar/CalendarGroupAlternatives.svelte';

const mounted: Array<ReturnType<typeof mount>> = [];
const containers: HTMLElement[] = [];
function render() {
  const target = document.createElement('div');
  document.body.append(target);
  containers.push(target);
  const onTogglePreview = vi.fn();
  const onChoose = vi.fn();
  mounted.push(mount(CalendarGroupAlternatives, { target, props: {
    alternatives: [{ groupId: 'h02', label: 'Exercise H02', eventCount: 7 }],
    previewGroupId: null, retainedGroupId: null,
    onPreview: vi.fn(), onTogglePreview, onChoose, contextKey: 'offering:h01',
  } }));
  flushSync();
  return { target, onTogglePreview, onChoose };
}
afterEach(async () => {
  for (const component of mounted.splice(0)) await unmount(component);
  for (const container of containers.splice(0)) container.remove();
});
describe('Calendar alternative Choose mode (#101)', () => {
  it('removes source-event counts and retains preview activation in normal mode', () => {
    const { target, onTogglePreview, onChoose } = render();
    expect(target.textContent).not.toContain('source events');
    target.querySelector<HTMLButtonElement>('.alternatives li button')!.click();
    expect(onTogglePreview).toHaveBeenCalledWith('h02');
    expect(onChoose).not.toHaveBeenCalled();
  });
  it('chooses the alternative once and returns to preview mode', () => {
    const { target, onTogglePreview, onChoose } = render();
    target.querySelector<HTMLButtonElement>('.choose-mode')!.click();
    flushSync();
    expect(target.querySelector<HTMLButtonElement>('.choose-mode')!.textContent).toContain('Cancel');
    target.querySelector<HTMLButtonElement>('.alternatives li button')!.click();
    flushSync();
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith('h02');
    expect(onTogglePreview).not.toHaveBeenCalled();
    expect(target.querySelector<HTMLButtonElement>('.choose-mode')!.textContent).toContain('Choose');
  });
  it('cancels without choosing or toggling preview', () => {
    const { target, onTogglePreview, onChoose } = render();
    const mode = target.querySelector<HTMLButtonElement>('.choose-mode')!;
    mode.click();
    flushSync();
    mode.click();
    flushSync();
    expect(onChoose).not.toHaveBeenCalled();
    expect(onTogglePreview).not.toHaveBeenCalled();
  });
});
