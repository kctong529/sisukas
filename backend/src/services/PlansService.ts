// src/services/PlansService.ts
import { db } from '../db';
import { plans, planInstances } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type { Plan } from '../domain/models/Plan';

export class PlansService {
  /**
   * Get all plans for a user with their instances
   */
  static async getPlansByUser(userId: string): Promise<Plan[]> {
    const userPlans = await db
      .select()
      .from(plans)
      .where(eq(plans.userId, userId));

    // Fetch instances for each plan
    const plansWithInstances = await Promise.all(
      userPlans.map(async (plan) => {
        const instances = await db
          .select({ instanceId: planInstances.instanceId })
          .from(planInstances)
          .where(eq(planInstances.planId, plan.id));

        return {
          id: plan.id,
          userId: plan.userId,
          name: plan.name,
          isActive: plan.isActive,
          instanceIds: instances.map(i => i.instanceId),
          createdAt: plan.createdAt,
          updatedAt: plan.updatedAt,
        };
      })
    );

    return plansWithInstances;
  }

  /**
   * Create a new plan for a user
   */
  static async createPlan(data: {
    userId: string;
    name: string;
  }): Promise<Plan> {
    const newPlan = await db
      .insert(plans)
      .values({
        userId: data.userId,
        name: data.name,
        isActive: false,
      })
      .returning();

    return {
      id: newPlan[0].id,
      userId: newPlan[0].userId,
      name: newPlan[0].name,
      isActive: newPlan[0].isActive,
      instanceIds: [],
      createdAt: newPlan[0].createdAt,
      updatedAt: newPlan[0].updatedAt,
    };
  }

  /**
   * Set a plan as active (deactivates all other plans for this user)
   */
  static async setActivePlan(userId: string, planId: string): Promise<Plan> {
    // Deactivate all other plans for this user
    await db
      .update(plans)
      .set({ isActive: false })
      .where(eq(plans.userId, userId));

    // Activate this plan
    const updatedPlan = await db
      .update(plans)
      .set({ isActive: true, updatedAt: new Date() })
      .where(and(eq(plans.id, planId), eq(plans.userId, userId)))
      .returning();

    if (!updatedPlan.length) {
      throw new Error('Plan not found');
    }

    // Fetch instances
    const instances = await db
      .select({ instanceId: planInstances.instanceId })
      .from(planInstances)
      .where(eq(planInstances.planId, planId));

    return {
      id: updatedPlan[0].id,
      userId: updatedPlan[0].userId,
      name: updatedPlan[0].name,
      isActive: updatedPlan[0].isActive,
      instanceIds: instances.map(i => i.instanceId),
      createdAt: updatedPlan[0].createdAt,
      updatedAt: updatedPlan[0].updatedAt,
    };
  }

  /**
   * Add an instance to a plan
   */
  static async addInstance(
    userId: string,
    planId: string,
    instanceId: string
  ): Promise<Plan> {
    // Check if instance already exists in plan
    const existing = await db
      .select()
      .from(planInstances)
      .where(
        and(
          eq(planInstances.planId, planId),
          eq(planInstances.instanceId, instanceId)
        )
      )
      .limit(1);

    // Only add if it doesn't already exist
    if (existing.length === 0) {
      await db.insert(planInstances).values({
        planId,
        instanceId,
      });

      // Update plan's updatedAt
      await db
        .update(plans)
        .set({ updatedAt: new Date() })
        .where(eq(plans.id, planId));
    }

    // Fetch and return updated plan
    return this.getPlanById(planId);
  }

  /**
   * Remove an instance from a plan
   */
  static async removeInstance(
    userId: string,
    planId: string,
    instanceId: string
  ): Promise<Plan> {
    await db
      .delete(planInstances)
      .where(
        and(
          eq(planInstances.planId, planId),
          eq(planInstances.instanceId, instanceId)
        )
      );

    // Update plan's updatedAt
    await db
      .update(plans)
      .set({ updatedAt: new Date() })
      .where(eq(plans.id, planId));

    // Fetch and return updated plan
    return this.getPlanById(planId);
  }

  /**
   * Verify that a user owns a plan
   */
  static async verifyOwnership(userId: string, planId: string): Promise<boolean> {
    const plan = await db
      .select()
      .from(plans)
      .where(and(eq(plans.id, planId), eq(plans.userId, userId)))
      .limit(1);

    return plan.length > 0;
  }

  /**
   * Get a single plan by ID with its instances
   */
  private static async getPlanById(planId: string): Promise<Plan> {
    const plan = await db
      .select()
      .from(plans)
      .where(eq(plans.id, planId))
      .limit(1);

    if (!plan.length) {
      throw new Error('Plan not found');
    }

    const instances = await db
      .select({ instanceId: planInstances.instanceId })
      .from(planInstances)
      .where(eq(planInstances.planId, planId));

    return {
      id: plan[0].id,
      userId: plan[0].userId,
      name: plan[0].name,
      isActive: plan[0].isActive,
      instanceIds: instances.map(i => i.instanceId),
      createdAt: plan[0].createdAt,
      updatedAt: plan[0].updatedAt,
    };
  }
}