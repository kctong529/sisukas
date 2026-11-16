import { auth } from "../infrastructure/betterAuth";

/** Resolve Better Auth's session once at the request boundary. */
export async function resolveAuthenticatedSession(headers: Headers) {
  return auth.api.getSession({ headers });
}
