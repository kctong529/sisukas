/** Handle only the public OAuth error code; never display provider error details directly. */
export type OAuthCallbackError = {
  code: string;
  message: string;
};

const errorMessages: Record<string, string> = {
  account_not_linked:
    "A Sisukas account already exists for this email. Sign in with an email link to access your account. You can connect Google from account settings when that feature becomes available.",
  access_denied: "Google sign-in was cancelled or permission was denied. You can try again or use an email link.",
  state_not_found: "Your sign-in request expired. Please try again.",
  state_invalid: "Your sign-in request could not be verified. Please try again.",
  state_mismatch: "Your sign-in request could not be verified. Please try again.",
  account_already_linked_to_different_user:
    "This Google account is already connected to another Sisukas account. Try a different sign-in method.",
};

const fallbackMessage = "Google sign-in could not be completed. Please try again or use an email link.";

/** Returns the user-facing error and a cleaned, same-origin URL, without navigating. */
export function parseOAuthCallbackError(url: URL): {
  error: OAuthCallbackError | null;
  cleanUrl: string;
} {
  const code = url.searchParams.get("error");
  if (!code) return { error: null, cleanUrl: `${url.pathname}${url.search}${url.hash}` };

  // Ignore arbitrary error descriptions: the provider may include untrusted text.
  const clean = new URL(url);
  clean.searchParams.delete("error");
  clean.searchParams.delete("error_description");

  return {
    error: { code, message: errorMessages[code] ?? fallbackMessage },
    cleanUrl: `${clean.pathname}${clean.search}${clean.hash}`,
  };
}
