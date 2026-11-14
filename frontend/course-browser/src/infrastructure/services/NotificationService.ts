// src/infrastructure/services/NotificationService.ts

import { writable } from 'svelte/store';

export type NotificationType = 'success' | 'error';

export type Notification = {
  id: string;
  type: NotificationType;
  message: string;
  action?: { label: string; run: () => void };
};

const NOTIFICATION_DURATION = {
  success: 3000,
  error: 5000,
};

const MAX_NOTIFICATIONS = 3;

export const notifications = writable<Notification[]>([]);

export class NotificationService {
  private static timeouts = new Map<string, ReturnType<typeof setTimeout>>();

  static dismiss(id: string): void {
    const timer = this.timeouts.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timeouts.delete(id);
    }
    notifications.update(items => items.filter(item => item.id !== id));
  }

  private static push(
    type: NotificationType,
    message: string,
    action?: Notification['action'],
  ): string {
    const id = crypto.randomUUID();
    let evicted: string | undefined;

    notifications.update(items => {
      if (items.length >= MAX_NOTIFICATIONS) {
        evicted = items[0]?.id;
        items = items.slice(1);
      }
      return [...items, { id, type, message, ...(action ? { action } : {}) }];
    });
    if (evicted) {
      const timer = this.timeouts.get(evicted);
      if (timer) clearTimeout(timer);
      this.timeouts.delete(evicted);
    }

    // Actionable errors remain available until resolved or explicitly dismissed.
    if (!action) {
      this.timeouts.set(id, setTimeout(() => {
        this.dismiss(id);
      }, NOTIFICATION_DURATION[type]));
    }
    return id;
  }

  static success(message: string): void {
    this.push('success', message);
  }

  static error(message: string): void {
    this.push('error', message);
  }

  static errorWithAction(message: string, label: string, run: () => void): string {
    return this.push('error', message, { label, run });
  }
}
