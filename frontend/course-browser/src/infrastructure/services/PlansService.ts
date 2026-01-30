// src/infrastructure/services/PlansService.ts

import type { Plan } from '../../domain/models/Plan';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export class PlansService {
  /**
   * Load all plans for the current user
   */
  static async loadAll(): Promise<Plan[]> {
    try {
      const response = await fetch(`${API_BASE}/api/plans`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        throw new Error(`Failed to fetch plans: ${response.statusText}`);
      }

      const data = await response.json();
      const plans = data || [];
      return plans;
    } catch (error) {
      console.error('Error loading plans:', error);
      throw error;
    }
  }

  /**
   * Create a new plan
   */
  static async create(name: string): Promise<Plan> {
    try {
      const response = await fetch(`${API_BASE}/api/plans`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        if (response.status === 400) {
          const error = await response.json();
          throw new Error(error.error || 'Invalid plan data');
        }
        throw new Error(`Failed to create plan: ${response.statusText}`);
      }

      const plan = await response.json();
      return plan;
    } catch (error) {
      console.error('Error creating plan:', error);
      throw error;
    }
  }

  /**
   * Set a plan as active
   */
  static async setActive(planId: string): Promise<Plan> {
    try {
      const response = await fetch(`${API_BASE}/api/plans/${planId}/activate`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        if (response.status === 404) {
          throw new Error('Plan not found');
        }
        throw new Error(`Failed to set active plan: ${response.statusText}`);
      }

      const plan = await response.json();
      return plan;
    } catch (error) {
      console.error('Error setting active plan:', error);
      throw error;
    }
  }

  /**
   * Add an instance to a plan
   */
  static async addInstance(planId: string, instanceId: string): Promise<Plan> {
    try {
      const response = await fetch(`${API_BASE}/api/plans/${planId}/instances`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ instanceId }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        if (response.status === 404) {
          throw new Error('Plan not found');
        }
        if (response.status === 400) {
          const error = await response.json();
          throw new Error(error.error || 'Invalid instance ID');
        }
        throw new Error(`Failed to add instance: ${response.statusText}`);
      }

      const plan = await response.json();
      return plan;
    } catch (error) {
      console.error('Error adding instance to plan:', error);
      throw error;
    }
  }

  /**
   * Remove an instance from a plan
   */
  static async removeInstance(planId: string, instanceId: string): Promise<Plan> {
    try {
      const response = await fetch(
        `${API_BASE}/api/plans/${planId}/instances/${instanceId}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        if (response.status === 404) {
          throw new Error('Plan or instance not found');
        }
        throw new Error(`Failed to remove instance: ${response.statusText}`);
      }

      const plan = await response.json();
      return plan;
    } catch (error) {
      console.error('Error removing instance from plan:', error);
      throw error;
    }
  }

  /**
   * Update plan name
   */
  static async updatePlanName(planId: string, newName: string): Promise<Plan> {
    try {
      const response = await fetch(`${API_BASE}/api/plans/${planId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newName }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        if (response.status === 404) {
          throw new Error('Plan not found');
        }
        if (response.status === 400) {
          const error = await response.json();
          throw new Error(error.error || 'Invalid plan data');
        }
        throw new Error(`Failed to update plan: ${response.statusText}`);
      }

      const plan = await response.json();
      return plan;
    } catch (error) {
      console.error('Error updating plan name:', error);
      throw error;
    }
  }

  /**
   * Remove a plan
   */
  static async removePlan(planId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/api/plans/${planId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        if (response.status === 404) {
          throw new Error('Plan not found');
        }
        throw new Error(`Failed to remove plan: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error removing plan:', error);
      throw error;
    }
  }
}

export const plansService = PlansService;
