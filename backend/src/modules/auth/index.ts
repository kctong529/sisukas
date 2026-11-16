/** Public backend authentication API consumed by HTTP middleware and services. */
export { createEmailPasswordUser } from "./application/createEmailPasswordUser";
export { resolveAuthenticatedSession } from "./application/resolveAuthenticatedSession";
export { toAuthenticatedIdentity } from "./domain/AuthenticatedIdentity";
export type { AuthenticatedIdentity } from "./domain/AuthenticatedIdentity";
export { authHttpHandler } from "./infrastructure/authHttpHandler";
