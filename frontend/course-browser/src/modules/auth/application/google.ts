import { authClient } from "../infrastructure/authClient";

/** Start ordinary Google sign-in; linking to an existing user is a separate flow (#217). */
export function signInWithGoogle(callbackURL: string) {
  return authClient.signIn.social({
    provider: "google",
    callbackURL,
    errorCallbackURL: callbackURL,
  });
}
