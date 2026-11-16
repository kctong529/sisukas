/** Public authentication boundary consumed by the HTTP layer. */
export { auth } from "./infrastructure/betterAuth";
export { resolveAuthenticatedSession } from "./application/resolveAuthenticatedSession";
export { toAuthenticatedIdentity } from "./domain/AuthenticatedIdentity";
export type { AuthenticatedIdentity } from "./domain/AuthenticatedIdentity";
