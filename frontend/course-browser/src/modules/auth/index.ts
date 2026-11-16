/** Public frontend authentication API. Never expose provider clients from this boundary. */
export { canonicalUserId } from "./application/identity";
export { parseOAuthCallbackError } from "./application/oauthCallbackError";
export type { OAuthCallbackError } from "./application/oauthCallbackError";
export { signInWithGoogle } from "./application/google";
export { signInWithMagicLink, verifyMagicLink } from "./application/magicLink";
export { signOut } from "./application/session";
export { googleSignInEnabled } from "./config/availableMethods";
export { useSession } from "./infrastructure/authClient";
