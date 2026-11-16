/**
 * Explicit account linking policy for Sisukas.
 *
 * Magic-link users may not have an `account` row, so account-row counts must
 * never be used as a proxy for available sign-in methods.
 *
 * Do not relax these settings when enabling a social provider (#216).
 */
export const accountLinkingPolicy = {
  enabled: true,
  disableImplicitLinking: true,
  allowDifferentEmails: false,
  allowUnlinkingAll: false,
  updateUserInfoOnLink: false,
} as const;
