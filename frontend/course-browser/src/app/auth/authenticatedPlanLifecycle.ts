import {
  authContextTransition,
  type ObservedAccountId,
} from "./authContextTransition";

export interface PlanLifecycleActions {
  clear(): void;
  ensureDefaultPlan(): Promise<void>;
}

export interface AccountDataLifecycleActions {
  clear(): void;
  load(): Promise<unknown>;
}

export interface AccountDataDependencies {
  favourites: AccountDataLifecycleActions;
  grades: AccountDataLifecycleActions;
  studyGroups?: { clear(): void };
}

/**
 * Coordinate plan initialization at settled account boundaries.
 * The plans store continues to own all plan data and request sharing.
 */
export function createAuthenticatedPlanLifecycle(
  actions: PlanLifecycleActions,
  reportError: (error: unknown) => void = console.error,
  accountData?: AccountDataDependencies,
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
      accountData?.favourites.clear();
      accountData?.grades.clear();
      accountData?.studyGroups?.clear();

      if (!transition.current) return;
      const initializingAccount = transition.current;

      const run = (operation: () => Promise<unknown>): void => {
        // Each store owns its loading state and guards obsolete responses.
        void operation().catch((error: unknown) => {
          if (observedAccount === initializingAccount) reportError(error);
        });
      };

      run(() => actions.ensureDefaultPlan());
      if (accountData) {
        run(() => accountData.favourites.load());
        run(() => accountData.grades.load());
      }
    },
  };
}
