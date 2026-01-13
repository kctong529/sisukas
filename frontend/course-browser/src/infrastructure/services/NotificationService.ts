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

export const notifications = writable<Notification[]>([]);

export class NotificationService {
  private static push(type: NotificationType, message: string) {
    const id = crypto.randomUUID();

    notifications.update(n => [...n, { id, type, message }]);

    setTimeout(() => {
      notifications.update(n => n.filter(x => x.id !== id));
    }, NOTIFICATION_DURATION[type]);
  }

  static success(message: string) {
    this.push('success', message);
  }

  static error(message: string) {
    this.push('error', message);
  }
}