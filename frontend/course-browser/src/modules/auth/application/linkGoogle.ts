import { authClient } from "../infrastructure/authClient";

/** Linking requires the existing authenticated session. Never use signIn.social here. */
export function linkGoogle(callbackURL: string) {
  return authClient.linkSocial({
    provider: "google",
    callbackURL,
    errorCallbackURL: callbackURL,
    additionalParams: {
      prompt: "select_account",
    },
  });
}
