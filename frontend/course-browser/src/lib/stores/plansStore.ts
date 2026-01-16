// src/lib/stores/plansStore.ts

import { writable, get } from 'svelte/store';
import { plansService } from '../../infrastructure/services/PlansService';
// import { mockPlansService as plansService } from '../../infrastructure/services/PlansService.mock';
import type { Plan } from '../../domain/models/Plan';

interface PlansStoreState {
  plans: Plan[];
  activePlan: Plan | null;
  loading: boolean;
  error: string | null;
}

function createPlansStore() {
  const initialState: PlansStoreState = {
    plans: [],
    activePlan: null,
    loading: false,
    error: null,
  };

  const { subscribe, set, update } = writable(initialState);

  return {
    subscribe,

    // Load all plans for current user
    async load() {
      update(s => ({ ...s, loading: true, error: null }));
      try {
        const plans = await plansService.loadAll();
        const activePlan = plans.find(p => p.isActive) || null;
        
        update(s => ({
          ...s,
          plans,
          activePlan,
          loading: false,
        }));
      } catch (err) {
        update(s => ({
          ...s,
          error: err instanceof Error ? err.message : 'Unknown error',
          loading: false,
        }));
        throw err;
      }
    },

    // Create a new plan
    async create(name: string) {
      update(s => ({ ...s, error: null }));
      try {
        const newPlan = await plansService.create(name);
        update(s => ({
          ...s,
          plans: [...s.plans, newPlan],
        }));
        return newPlan;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        update(s => ({ ...s, error: errorMsg }));
        throw err;
      }
    },

    // Set a plan as active (deactivates others)
    async setActive(planId: string) {
      update(s => ({ ...s, error: null }));
      try {
        const updatedPlan = await plansService.setActive(planId);
        update(s => ({
          ...s,
          plans: s.plans.map(p => ({
            ...p,
            isActive: p.id === planId,
          })),
          activePlan: updatedPlan,
        }));
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        update(s => ({ ...s, error: errorMsg }));
        throw err;
      }
    },

    // Add an instance to active plan
    async addInstanceToActivePlan(instanceId: string) {
      update(s => ({ ...s, error: null }));
      
      const state = get({ subscribe });
      const activePlan = state.activePlan;

      if (!activePlan) {
        const errorMsg = 'No active plan';
        update(s => ({ ...s, error: errorMsg }));
        throw new Error(errorMsg);
      }

      try {
        const updatedPlan = await plansService.addInstance(activePlan.id, instanceId);
        update(s => ({
          ...s,
          activePlan: updatedPlan,
          plans: s.plans.map(p => p.id === updatedPlan.id ? updatedPlan : p),
        }));
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        update(s => ({ ...s, error: errorMsg }));
        throw err;
      }
    },

    // Remove an instance from active plan
    async removeInstanceFromActivePlan(instanceId: string) {
      update(s => ({ ...s, error: null }));

      const state = get({ subscribe });
      const activePlan = state.activePlan;

      if (!activePlan) {
        const errorMsg = 'No active plan';
        update(s => ({ ...s, error: errorMsg }));
        throw new Error(errorMsg);
      }

      try {
        const updatedPlan = await plansService.removeInstance(activePlan.id, instanceId);
        update(s => ({
          ...s,
          activePlan: updatedPlan,
          plans: s.plans.map(p => p.id === updatedPlan.id ? updatedPlan : p),
        }));
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        update(s => ({ ...s, error: errorMsg }));
        throw err;
      }
    },

    clear() {
      set(initialState);
    },
  };
}

export const plansStore = createPlansStore();