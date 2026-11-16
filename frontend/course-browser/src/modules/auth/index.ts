/** Frontend authentication boundary. Provider-specific code stays in this module. */
export { authClient, signIn, signUp, signOut, useSession } from "./infrastructure/authClient";
export { signInWithMagicLink, verifyMagicLink } from "./application/magicLink";
export { canonicalUserId } from "./application/identity";
