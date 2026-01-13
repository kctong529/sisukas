<!-- src/components/NotificationContainer.svelte -->
<script lang="ts">
  import { notifications } from '../infrastructure/services/NotificationService';
</script>

<div id="notification-container">
  {#each $notifications as n (n.id)}
    <div class="filter-notification {n.type}">
      <i class="bi {n.type === 'success' ? 'bi-check-circle' : 'bi-exclamation-circle'}"></i>
      <span>{n.message}</span>
    </div>
  {/each}
</div>

<style>
  #notification-container {
    position: fixed;
    top: 48px;
    left: 15px;
    z-index: 1000;
    pointer-events: none;
    max-width: calc(100vw - 40px);
  }

  .filter-notification {
    padding: 5px 10px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 10px;
    box-shadow: 0 4px 12px rgb(0 0 0 / 15%);
    animation: slide-in 0.3s ease;
    margin-bottom: 10px;
    pointer-events: auto;
    max-width: 500px;
    word-wrap: break-word;
  }

  .filter-notification.error {
    background: #fee;
    border-left: 4px solid #c33;
    color: #c33;
  }

  .filter-notification.success {
    background: #efe;
    border-left: 4px solid #3c3;
    color: #3c3;
  }

  /* Icon Sizing */
  .filter-notification i {
    flex-shrink: 0;
  }

  /* Text Content */
  .filter-notification span {
    flex: 1;
    min-width: 0;
  }

  /* Slide-in Animation */
  @keyframes slide-in {
    from {
      transform: translateX(-400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  /* Responsive Design for Notifications */
  @media (width <= 620px) {
    #notification-container {
      left: 10px;
      right: 10px;
      max-width: calc(100vw - 20px);
    }

    .filter-notification {
      padding: 12px 15px;
      font-size: clamp(10px, 1.3vw, 15px);
      max-width: 100%;
    }
  }

</style>