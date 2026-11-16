/** Always key user-owned frontend state by the Sisukas user ID. */
export function canonicalUserId(session: { user?: { id?: string } | null } | null | undefined): string | null {
  return session?.user?.id ?? null;
}
