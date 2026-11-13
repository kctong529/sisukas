// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getStudyGroupDataRuntime } from '@modules/study-groups';

import BlocksGrid from '../../../src/components/planning/BlocksGrid.svelte';
import { blockStore } from '../../../src/lib/stores/blockStore';

import type { Course } from '@domain/models/Course';
import type { StudyGroupEntry } from '@modules/study-groups';

const course = { id: 'offering-a', unitId: 'unit-a' } as Course;
const groups = [
  { groupId: 'g1', name: 'L01', type: 'Lecture', studyEvents: [] },
  { groupId: 'g2', name: 'L02', type: 'Lecture', studyEvents: [] },
  { groupId: 'g3', name: 'L03', type: 'Lecture', studyEvents: [] },
];
const ready: StudyGroupEntry = {
  status: 'ready', groups, fetchedAt: 123, error: null, refreshing: false,
};
let component: ReturnType<typeof mount>;
let target: HTMLDivElement;
let remove: ReturnType<typeof vi.spyOn>;
let create: ReturnType<typeof vi.spyOn>;
let begin: ReturnType<typeof vi.spyOn>;

function square(index: number): HTMLElement {
  return target.querySelectorAll<HTMLElement>('.study-group-square')[index];
}
function key(index: number, code: string, options: KeyboardEventInit = {}): boolean {
  return square(index).dispatchEvent(new KeyboardEvent('keydown', {
    key: code, bubbles: true, cancelable: true, ...options,
  }));
}
async function settle() {
  // Store actions and the Svelte paint bridge are asynchronous.
  await new Promise(resolve => setTimeout(resolve, 0));
  flushSync();
}

beforeEach(() => {
  const runtime = getStudyGroupDataRuntime();
  vi.spyOn(runtime, 'entry').mockReturnValue(writable(ready));
  vi.spyOn(runtime, 'ensure').mockResolvedValue();
  vi.spyOn(blockStore, 'fetchForInstance').mockResolvedValue([]);
  vi.spyOn(blockStore, 'autoPartitionForInstance').mockImplementation(() => {});
  begin = vi.spyOn(blockStore, 'beginDragSelect').mockResolvedValue({ previewColorIndex: 0 });
  remove = vi.spyOn(blockStore, 'removeBlockIfGroupIsAssigned').mockResolvedValue(false);
  create = vi.spyOn(blockStore, 'createBlock').mockResolvedValue(undefined as never);
  target = document.createElement('div');
  document.body.append(target);
  component = mount(BlocksGrid, { target, props: { course } });
  flushSync();
});

afterEach(async () => {
  await unmount(component);
  target.remove();
  vi.restoreAllMocks();
  blockStore.clear();
});

describe('BlocksGrid study-group keyboard access (#125)', () => {
  it('exposes each group as a focusable button with its persisted assignment state', () => {
    expect(target.querySelectorAll('.study-group-square')).toHaveLength(3);
    expect(square(0).getAttribute('role')).toBe('button');
    expect(square(0).tabIndex).toBe(0);
    expect(square(0).getAttribute('aria-pressed')).toBe('false');
  });

  it.each(['Enter', ' '])('toggles a group with %s without scrolling', async (activation) => {
    expect(key(1, activation)).toBe(false);
    await settle();
    expect(begin).toHaveBeenCalledWith(course.id);
    expect(remove).toHaveBeenCalledWith(course.id, 'g2');
    expect(create).toHaveBeenCalledWith(course.id, 'Block (1 group)', ['g2'], 0, 0);
  });

  it('removes an assigned group rather than creating another block', async () => {
    remove.mockResolvedValueOnce(true);
    key(0, 'Enter');
    await settle();
    expect(remove).toHaveBeenCalledWith(course.id, 'g1');
    expect(create).not.toHaveBeenCalled();
  });

  it('ignores repeats, modifiers and unrelated keys', async () => {
    key(0, 'ArrowRight');
    key(0, 'Enter', { repeat: true });
    key(0, ' ', { ctrlKey: true });
    await settle();
    expect(remove).not.toHaveBeenCalled();
  });

  it('does not create duplicate blocks while an activation is pending', async () => {
    let finish!: () => void;
    remove.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve(false); }));
    key(0, 'Enter');
    await settle();
    key(0, ' ');
    finish();
    await settle();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('keeps single-click and range-drag pointer behavior', async () => {
    square(0).dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, cancelable: true }));
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await settle();
    expect(remove).toHaveBeenCalledWith(course.id, 'g1');
    expect(create).toHaveBeenCalledWith(course.id, 'Block (1 group)', ['g1'], 0, 0);

    remove.mockClear();
    create.mockClear();
    square(0).dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, cancelable: true }));
    square(2).dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await settle();
    expect(remove).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(course.id, 'Block (3 groups)', ['g1', 'g2', 'g3'], 0, 0);
  });

  it('preserves touch activation for a single group', async () => {
    square(1).dispatchEvent(new Event('touchstart', { bubbles: true, cancelable: true }));
    square(1).dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }));
    await settle();
    expect(remove).toHaveBeenCalledWith(course.id, 'g2');
    expect(create).toHaveBeenCalledWith(course.id, 'Block (1 group)', ['g2'], 0, 0);
  });
});
