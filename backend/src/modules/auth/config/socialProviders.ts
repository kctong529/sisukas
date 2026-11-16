import type { BetterAuthOptions } from "better-auth";

type SocialProviders = NonNullable<BetterAuthOptions["socialProviders"]>;

/**
 * Provider registration is backend-only. Do not expose credentials to Vite.
 * Disabled by default, including when the flag is unset.
 *
 * Accepting an environment argument makes deployment validation testable
 * without mutating process.env or constructing the Better Auth singleton.
 */
export function configuredSocialProviders(
  environment: NodeJS.ProcessEnv = process.env,
): SocialProviders {
  const flag = environment.GOOGLE_OAUTH_ENABLED;

  if (flag === undefined || flag === "" || flag === "false") {
    return {};
  }

  if (flag !== "true") {
    throw new Error("GOOGLE_OAUTH_ENABLED must be 'true' or 'false'");
  }

  const clientId = environment.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = environment.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    // Deliberately do not print either credential in an error message.
    throw new Error("Google OAuth enabled but client credentials are missing");
  }

  return {
    google: {
      clientId,
      clientSecret,
    },
  };
}
