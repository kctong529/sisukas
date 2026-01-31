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
    return state.ids.map(id => state.byId.get(id)).filter(Boolean) as Plan[];
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
let ensureDefaultPromise: Promise<void> | null = null;

function normalizeActive(activeId: string | null) {
  // Pick a fallback if activeId is null but we have plans
  const finalActiveId = activeId ?? state.ids[0] ?? null;

  state.activePlanId = finalActiveId;

  // Rewrite ALL plans to enforce at most one isActive
  const next = new Map(state.byId);
  for (const id of state.ids) {
    const p = next.get(id);
    if (!p) continue;
    const shouldBeActive = id === finalActiveId;
    if (p.isActive !== shouldBeActive) {
      next.set(id, { ...p, isActive: shouldBeActive });
    }
  }
  state.byId = next;
}

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

        // if backend sends multiple actives, choose one deterministically
        const serverActiveIds = plans.filter(p => p.isActive).map(p => p.id);
        normalizeActive(serverActiveIds[0] ?? null);

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

  /**
   * Ensure the user has at least one plan, and that some plan is active.
   * Concurrency-safe: multiple callers share the same in-flight promise.
   */
  async ensureDefaultPlan(): Promise<void> {
    // Fast-path: already has at least one plan and active plan
    if (state.ids.length > 0 && state.activePlanId) return;

    if (ensureDefaultPromise) return ensureDefaultPromise;

    ensureDefaultPromise = (async () => {
      await actions.ensureLoaded();

      // Re-check after load (important)
      const plans = read.getAll();
      const active = read.getActive();

      if (plans.length === 0) {
        const p = await actions.create("Default");
        await actions.setActive(p.id);
        return;
      }

      if (!active) {
        await actions.setActive(plans[0].id);
      }
    })().finally(() => {
      ensureDefaultPromise = null;
    });

    return ensureDefaultPromise;
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
    const updatedPlan = await plansService.setActive(planId);
    
    // Update the server-returned plan
    state.byId = new Map(state.byId).set(planId, updatedPlan);

    // Enforce invariant locally regardless of what else is in memory
    normalizeActive(planId);
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
      // Make sure we have a consistent baseline
      await actions.ensureLoaded();

      const isLastPlan = state.ids.length === 1 && state.ids[0] === planId;
      const wasActive = state.activePlanId === planId;

      // If the user is removing the last remaining plan,
      // create a replacement FIRST (server + local), activate it,
      // then delete the old plan.
      if (isLastPlan) {
        const replacement = await actions.create("Empty");
        await actions.setActive(replacement.id);
        // now we are guaranteed to have at least one plan besides `planId`
      } else if (wasActive) {
        // If deleting the active plan and it's not the last one,
        // switch active to a fallback BEFORE deleting to keep UI stable.
        const fallbackId = state.ids.find((id) => id !== planId) ?? null;
        if (fallbackId) await actions.setActive(fallbackId);
        else normalizeActive(null); // defensive, should not happen since !isLastPlan
      }

      // Now delete on server
      await plansService.removePlan(planId);

      // Remove locally
      const nextById = new Map(state.byId);
      nextById.delete(planId);
      state.byId = nextById;
      state.ids = state.ids.filter((id) => id !== planId);

      // Final safety: ensure active points to an existing plan and flags are consistent
      if (state.activePlanId && !state.byId.has(state.activePlanId)) {
        normalizeActive(state.ids[0] ?? null);
      } else {
        normalizeActive(state.activePlanId);
      }
    } catch (err) {
      state.error = err instanceof Error ? err.message : "Failed to remove plan";
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
    ensureDefaultPromise = null;
  },
};

export const plansStore = {
  state,
  read,
  actions,
};
