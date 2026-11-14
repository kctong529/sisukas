/** A null account means a settled, signed-out session. */
export type AccountId = string | null;

/** Undefined means authentication has not yet been observed as settled. */
export type ObservedAccountId = AccountId | undefined;

export interface AuthContextTransition {
  previous: ObservedAccountId;
  current: AccountId;
}

/**
 * Recognize changes in authenticated account identity.
 *
 * Pending sessions are deliberately ignored: they do not establish
 * a signed-out context or invalidate a previously authenticated one.
 * This function has no store, network, or cleanup side effects.
 */
export function authContextTransition(
  previous: ObservedAccountId,
  pending: boolean,
  userId: AccountId,
): AuthContextTransition | null {
  if (pending || previous === userId) return null;

  return { previous, current: userId };
}
