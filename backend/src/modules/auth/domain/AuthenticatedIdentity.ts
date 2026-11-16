/** Stable application identity: never use a provider ID or session ID as user ownership. */
export interface AuthenticatedIdentity {
  userId: string;
  email: string;
  emailVerified: boolean;
}

export function toAuthenticatedIdentity(user: { id: string; email: string; emailVerified: boolean } | null | undefined): AuthenticatedIdentity | null {
  if (!user) return null;
  return { userId: user.id, email: user.email, emailVerified: user.emailVerified };
}
