/** A browser-local consistency marker, NOT an authentication or authorization credential. */
export interface PendingGoogleLink {
  originalUserId: string;
}

export interface GoogleLinkReturn {
  originalUserId: string | null;
  errorCode: string | null;
}

const key = "sisukas:google-link-pending";
const callbackParam = "account_link";

export function googleLinkCallbackURL(frontendURL: string): string {
  const url = new URL(frontendURL);
  url.searchParams.set(callbackParam, "google");
  return url.toString();
}

export function savePendingGoogleLink(storage: Pick<Storage, "setItem">, originalUserId: string): void {
  if (!originalUserId) throw new Error("A signed-in user is required to link Google.");
  storage.setItem(key, originalUserId);
}

export function clearPendingGoogleLink(storage: Pick<Storage, "removeItem">): void {
  storage.removeItem(key);
}

/** Consume a link callback before the ordinary sign-in error parser (#222). */
export function consumeGoogleLinkReturn(url: URL, storage: Pick<Storage, "getItem" | "removeItem">): {
  result: GoogleLinkReturn | null;
  cleanUrl: string;
} {
  if (url.searchParams.get(callbackParam) !== "google") {
    return { result: null, cleanUrl: `${url.pathname}${url.search}${url.hash}` };
  }
  const originalUserId = storage.getItem(key);
  storage.removeItem(key);
  const errorCode = url.searchParams.get("error");
  const clean = new URL(url);
  clean.searchParams.delete(callbackParam);
  clean.searchParams.delete("error");
  clean.searchParams.delete("error_description");
  return {
    result: { originalUserId, errorCode },
    cleanUrl: `${clean.pathname}${clean.search}${clean.hash}`,
  };
}

export function googleLinkErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case "account_already_linked_to_different_user":
      return "This Google account is already connected to another Sisukas account. No accounts were merged.";
    case "access_denied":
      return "Google linking was cancelled or permission was denied. Your account was not changed.";
    case "state_not_found":
    case "state_invalid":
    case "state_mismatch":
      return "The Google linking request expired or could not be verified. Please try again.";
    default:
      return "Google linking could not be completed. Please retry or check your connected methods.";
  }
}

/** Confirm only after reading the real session and provider associations. */
export function evaluateGoogleLinkReturn(
  callback: GoogleLinkReturn,
  currentUserId: string,
  googleConnected: boolean,
): { success: boolean; message: string } {
  if (!callback.originalUserId || callback.originalUserId !== currentUserId) {
    return {
      success: false,
      message: "Could not verify the original account identity. Please sign in again and inspect your connected methods.",
    };
  }
  if (callback.errorCode) {
    return { success: false, message: googleLinkErrorMessage(callback.errorCode) };
  }
  if (!googleConnected) {
    return {
      success: false,
      message: "Google linking could not be confirmed. Your existing account remains available.",
    };
  }
  return { success: true, message: "Google was connected to your existing Sisukas account." };
}
