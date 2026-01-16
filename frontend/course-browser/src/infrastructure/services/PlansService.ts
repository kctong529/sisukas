// src/infrastructure/services/PlansService.ts

import type { Plan } from '../../domain/models/Plan';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export class PlansService {
  private baseUrl = `${API_BASE}/api/plans`;

  async loadAll(): Promise<Plan[]> {
    const response = await fetch(this.baseUrl, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(`Failed to load plans: ${response.statusText}`);
    }
    return response.json();
  }

  async create(name: string): Promise<Plan> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      throw new Error(`Failed to create plan: ${response.statusText}`);
    }
    return response.json();
  }

  async setActive(planId: string): Promise<Plan> {
    const response = await fetch(`${this.baseUrl}/${planId}/activate`, {
      method: 'PATCH',
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(`Failed to activate plan: ${response.statusText}`);
    }
    return response.json();
  }

  async addInstance(planId: string, instanceId: string): Promise<Plan> {
    const response = await fetch(`${this.baseUrl}/${planId}/instances`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceId }),
    });
    if (!response.ok) {
      throw new Error(`Failed to add instance: ${response.statusText}`);
    }
    return response.json();
  }

  async removeInstance(planId: string, instanceId: string): Promise<Plan> {
    const response = await fetch(`${this.baseUrl}/${planId}/instances/${instanceId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(`Failed to remove instance: ${response.statusText}`);
    }
    return response.json();
  }
}

export const plansService = new PlansService();