import { authClient } from "../infrastructure/authClient";

/** Magic-link method adapter; the UI need not know Better Auth plugin paths. */
export function signInWithMagicLink(email: string, callbackURL: string) {
  return authClient.signIn.magicLink({ email, callbackURL });
}

export function verifyMagicLink(token: string, callbackURL: string) {
  return authClient.magicLink.verify({ query: { token, callbackURL } });
}
