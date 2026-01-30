// src/lib/stores/plansStore.svelte.ts

import { plansService } from '../../infrastructure/services/PlansService';
import type { Plan } from '../../domain/models/Plan';

const state = $state({
  byId: new Map<string, Plan>(),
  ids: [] as string[],
  activePlanId: null as string | null,

  loading: false,
  loaded: false,
  error: null as string | null,
});

const read = {
  getAll() {
    return state.ids.map(id => state.byId.get(id)!);
  },

  getActive() {
    if (!state.activePlanId) return null;
    return state.byId.get(state.activePlanId) ?? null;
  },

  getById(id: string) {
    return state.byId.get(id) ?? null;
  },

  count() {
    return state.ids.length;
  },
};

let loadPromise: Promise<void> | null = null;

const actions = {
  async ensureLoaded(): Promise<void> {
    if (state.loaded) return;
    if (loadPromise) return loadPromise;

    state.loading = true;
    loadPromise = (async () => {
      try {
        const plans = await plansService.loadAll();
        state.byId = new Map(plans.map(p => [p.id, p]));
        state.ids = plans.map(p => p.id);
        state.activePlanId = plans.find(p => p.isActive)?.id ?? null;
        state.loaded = true;
      } catch (err) {
        state.error = err instanceof Error ? err.message : 'Failed to load plans';
        throw err;
      } finally {
        state.loading = false;
        loadPromise = null;
      }
    })();

    return loadPromise;
  },

  async create(name: string): Promise<Plan> {
    state.error = null;
    try {
      const newPlan = await plansService.create(name);
      state.byId = new Map(state.byId).set(newPlan.id, newPlan);
      state.ids = [...state.ids, newPlan.id];
      return newPlan;
    } catch (err) {
      state.error = err instanceof Error ? err.message : 'Failed to create plan';
      throw err;
    }
  },

  async setActive(planId: string): Promise<void> {
    state.error = null;
    try {
      const updatedPlan = await plansService.setActive(planId);
      // Deactivate old active plan
      if (state.activePlanId) {
        const oldPlan = state.byId.get(state.activePlanId);
        if (oldPlan) {
          state.byId = new Map(state.byId).set(state.activePlanId, {
            ...oldPlan,
            isActive: false,
          });
        }
      }
      // Activate new plan
      state.byId = new Map(state.byId).set(planId, updatedPlan);
      state.activePlanId = planId;
    } catch (err) {
      state.error = err instanceof Error ? err.message : 'Failed to set active plan';
      throw err;
    }
  },

  async addInstanceToActivePlan(instanceId: string): Promise<void> {
    state.error = null;
    if (!state.activePlanId) {
      state.error = 'No active plan';
      throw new Error('No active plan');
    }

    try {
      const updatedPlan = await plansService.addInstance(state.activePlanId, instanceId);
      state.byId = new Map(state.byId).set(state.activePlanId, updatedPlan);
    } catch (err) {
      state.error = err instanceof Error ? err.message : 'Failed to add instance';
      throw err;
    }
  },

  async removeInstanceFromActivePlan(instanceId: string): Promise<void> {
    state.error = null;
    if (!state.activePlanId) {
      state.error = 'No active plan';
      throw new Error('No active plan');
    }

    try {
      const updatedPlan = await plansService.removeInstance(state.activePlanId, instanceId);
      state.byId = new Map(state.byId).set(state.activePlanId, updatedPlan);
    } catch (err) {
      state.error = err instanceof Error ? err.message : 'Failed to remove instance';
      throw err;
    }
  },

  async updatePlanName(planId: string, newName: string): Promise<void> {
    state.error = null;
    try {
      const updatedPlan = await plansService.updatePlanName(planId, newName);
      state.byId = new Map(state.byId).set(planId, updatedPlan);
    } catch (err) {
      state.error = err instanceof Error ? err.message : 'Failed to update plan';
      throw err;
    }
  },

  async removePlan(planId: string): Promise<void> {
    state.error = null;
    try {
      await plansService.removePlan(planId);
      state.byId = new Map(state.byId);
      state.byId.delete(planId);
      state.ids = state.ids.filter(id => id !== planId);
      
      // Clear active plan if it was removed
      if (state.activePlanId === planId) {
        state.activePlanId = state.ids[0] ?? null;
      }
    } catch (err) {
      state.error = err instanceof Error ? err.message : 'Failed to remove plan';
      throw err;
    }
  },

  clear() {
    state.byId = new Map();
    state.ids = [];
    state.activePlanId = null;
    state.loading = false;
    state.loaded = false;
    state.error = null;
    loadPromise = null;
  },
};

export const plansStore = {
  state,
  read,
  actions,
};
