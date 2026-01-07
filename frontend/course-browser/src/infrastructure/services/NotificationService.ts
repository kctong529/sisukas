// src/infrastructure/services/NotificationService.ts

export type NotificationType = 'success' | 'error';

const NOTIFICATION_DURATION = {
  success: 3000,
  error: 5000
};

/**
 * Service for showing user notifications
 */
export class NotificationService {
  private static container: HTMLElement | null = null;

  private static getOrCreateContainer(): HTMLElement {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'notification-container';
      document.body.appendChild(this.container);
    }
    return this.container;
  }

  private static removeExisting() {
    const existing = document.querySelectorAll('.filter-notification');
    existing.forEach(notif => notif.remove());
  }

  static show(message: string, type: NotificationType) {
    this.removeExisting();

    const notification = document.createElement('div');
    notification.className = `filter-notification ${type}`;
    
    const icon = type === 'success' ? 'bi-check-circle' : 'bi-exclamation-circle';
    notification.innerHTML = `
      <i class="bi ${icon}"></i>
      <span>${message}</span>
    `;

    const container = this.getOrCreateContainer();
    container.appendChild(notification);

    const duration = NOTIFICATION_DURATION[type];
    setTimeout(() => notification.remove(), duration);
  }

  static success(message: string) {
    this.show(message, 'success');
  }

  static error(message: string) {
    this.show(message, 'error');
  }
}