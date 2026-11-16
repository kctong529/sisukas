/** Public frontend authentication API. Never expose provider clients from this boundary. */
export { canonicalUserId } from "./application/identity";
export { signInWithMagicLink, verifyMagicLink } from "./application/magicLink";
export { signOut } from "./application/session";
export { useSession } from "./infrastructure/authClient";
