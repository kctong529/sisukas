import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NotificationService, notifications } from '@infrastructure/services/NotificationService';

describe('NotificationService actionable errors', () => {
  afterEach(() => {
    for (const notification of get(notifications)) NotificationService.dismiss(notification.id);
    vi.useRealTimers();
  });

  it('keeps actionable errors visible until dismissed', () => {
    vi.useFakeTimers();
    const retry = vi.fn();
    const id = NotificationService.errorWithAction('Save failed', 'Retry', retry);

    expect(get(notifications).find(item => item.id === id)?.action?.label).toBe('Retry');
    vi.advanceTimersByTime(10_000);
    expect(get(notifications).some(item => item.id === id)).toBe(true);

    get(notifications).find(item => item.id === id)?.action?.run();
    expect(retry).toHaveBeenCalledOnce();
    NotificationService.dismiss(id);
    expect(get(notifications).some(item => item.id === id)).toBe(false);
  });

  it('preserves timed behavior for ordinary success/error messages', () => {
    vi.useFakeTimers();
    NotificationService.success('Saved');
    NotificationService.error('Other failure');
    expect(get(notifications)).toHaveLength(2);
    vi.advanceTimersByTime(3000);
    expect(get(notifications).map(item => item.message)).toEqual(['Other failure']);
    vi.advanceTimersByTime(2000);
    expect(get(notifications)).toHaveLength(0);
  });

  it('limits notifications to three while evicting the oldest', () => {
    vi.useFakeTimers();
    for (let i = 0; i < 4; i += 1) NotificationService.error(`Failure ${i}`);
    expect(get(notifications).map(item => item.message)).toEqual([
      'Failure 1', 'Failure 2', 'Failure 3',
    ]);
  });
});
