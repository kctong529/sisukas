/** Build-time presentation flag. The backend independently controls provider availability. */
export function isGoogleSignInEnabled(value: string | undefined): boolean {
  return value === "true";
}

export const googleSignInEnabled = isGoogleSignInEnabled(
  import.meta.env.VITE_GOOGLE_OAUTH_ENABLED,
);
