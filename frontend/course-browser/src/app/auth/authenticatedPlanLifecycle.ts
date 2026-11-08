import {
  authContextTransition,
  type ObservedAccountId,
} from "./authContextTransition";

export interface PlanLifecycleActions {
  clear(): void;
  ensureDefaultPlan(): Promise<void>;
}

/**
 * Coordinate plan initialization at settled account boundaries.
 * The plans store continues to own all plan data and request sharing.
 */
export function createAuthenticatedPlanLifecycle(
  actions: PlanLifecycleActions,
  reportError: (error: unknown) => void = console.error,
) {
  let observedAccount: ObservedAccountId = undefined;

  return {
    update(pending: boolean, userId: string | null): void {
      const transition = authContextTransition(
        observedAccount,
        pending,
        userId,
      );
      if (!transition) return;

      observedAccount = transition.current;
      actions.clear();

      if (!transition.current) return;
      const initializingAccount = transition.current;

      void actions.ensureDefaultPlan().catch((error: unknown) => {
        // Ignore failures from a previous account lifecycle.
        if (observedAccount === initializingAccount) reportError(error);
      });
    },
  };
}
