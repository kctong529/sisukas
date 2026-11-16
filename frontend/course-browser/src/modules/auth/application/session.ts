import { authClient } from "../infrastructure/authClient";

/** End the current authentication session without exposing Better Auth internals to UI code. */
export function signOut() {
  return authClient.signOut();
}
