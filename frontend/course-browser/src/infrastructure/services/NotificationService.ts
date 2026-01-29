// src/infrastructure/services/NotificationService.ts

import { writable } from 'svelte/store';

export type NotificationType = 'success' | 'error';

export type Notification = {
  id: string;
  type: NotificationType;
  message: string;
};

const NOTIFICATION_DURATION = {
  success: 3000,
  error: 5000
};

const MAX_NOTIFICATIONS = 3;

export const notifications = writable<Notification[]>([]);

export class NotificationService {
  private static timeouts = new Map<string, ReturnType<typeof setTimeout>>();

  private static remove(id: string) {
    const t = this.timeouts.get(id);
    if (t) {
      clearTimeout(t);
      this.timeouts.delete(id);
    }

    notifications.update(n => n.filter(x => x.id !== id));
  }

  private static push(type: NotificationType, message: string) {
    const id = crypto.randomUUID();

    notifications.update(n => {
      if (n.length >= MAX_NOTIFICATIONS) {
        const oldest = n[0];
        if (oldest) this.remove(oldest.id);
        n = n.slice(1);
      }

      return [...n, { id, type, message }];
    });

    const timeout = setTimeout(() => {
      this.remove(id);
    }, NOTIFICATION_DURATION[type]);

    this.timeouts.set(id, timeout);
  }

  static success(message: string) {
    this.push('success', message);
  }

  static error(message: string) {
    this.push('error', message);
  }
}
