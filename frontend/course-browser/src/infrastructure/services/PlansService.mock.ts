// src/infrastructure/services/PlansService.mock.ts

import type { Plan } from '../../domain/models/Plan';

/**
 * Mock implementation of PlansService for testing and development
 * Does not hit the real API, keeps everything in memory
 */
export class MockPlansService {
  private plans: Map<string, Plan> = new Map();
  private activePlanId: string | null = null;

  constructor() {
    this.seed();
  }

  /**
   * Seed with some test data
   */
  private seed() {
    const plan1: Plan = {
      id: 'plan-seed-1',
      userId: 'user-123',
      name: 'Spring 2025',
      isActive: true,
      instanceIds: ['inst-001', 'inst-002'],
      createdAt: new Date('2025-01-10'),
      updatedAt: new Date('2025-01-15'),
    };

    const plan2: Plan = {
      id: 'plan-seed-2',
      userId: 'user-123',
      name: 'Fall 2024',
      isActive: false,
      instanceIds: ['inst-003'],
      createdAt: new Date('2024-08-01'),
      updatedAt: new Date('2024-08-05'),
    };

    this.plans.set(plan1.id, plan1);
    this.plans.set(plan2.id, plan2);
    this.activePlanId = 'plan-seed-1';
  }

  async loadAll(): Promise<Plan[]> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return Array.from(this.plans.values());
  }

  async create(name: string): Promise<Plan> {
    await new Promise(resolve => setTimeout(resolve, 100));

    // Use timestamp + random for unique ID
    const newId = `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newPlan: Plan = {
      id: newId,
      userId: 'user-123',
      name,
      isActive: false,
      instanceIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.plans.set(newPlan.id, newPlan);
    return newPlan;
  }

  async setActive(planId: string): Promise<Plan> {
    await new Promise(resolve => setTimeout(resolve, 100));

    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    // Deactivate others
    this.plans.forEach(p => {
      p.isActive = false;
    });

    // Activate this one
    plan.isActive = true;
    plan.updatedAt = new Date();
    this.activePlanId = planId;

    return plan;
  }

  async addInstance(planId: string, instanceId: string): Promise<Plan> {
    await new Promise(resolve => setTimeout(resolve, 100));

    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    // Don't add duplicates
    if (!plan.instanceIds.includes(instanceId)) {
      plan.instanceIds.push(instanceId);
    }

    plan.updatedAt = new Date();
    return plan;
  }

  async removeInstance(planId: string, instanceId: string): Promise<Plan> {
    await new Promise(resolve => setTimeout(resolve, 100));

    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }

    plan.instanceIds = plan.instanceIds.filter(id => id !== instanceId);
    plan.updatedAt = new Date();

    return plan;
  }

  /**
   * Reset to seed data (useful for testing)
   */
  reset() {
    this.plans.clear();
    this.seed();
  }

  /**
   * Get all plans (for debugging)
   */
  debug() {
    return Array.from(this.plans.values());
  }
}

export const mockPlansService = new MockPlansService();