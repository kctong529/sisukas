import { describe, expect, it } from "vitest";
import { configuredSocialProviders } from "../../src/modules/auth/config/socialProviders";

describe("Google social provider configuration (#216)", () => {
  it("disables Google by default", () => {
    expect(configuredSocialProviders({})).toEqual({});
  });

  it("disables Google when explicitly set to false", () => {
    expect(configuredSocialProviders({
      GOOGLE_OAUTH_ENABLED: "false",
      GOOGLE_CLIENT_ID: "ignored-client",
      GOOGLE_CLIENT_SECRET: "ignored-secret",
    })).toEqual({});
  });

  it("registers Google with both credentials when enabled", () => {
    expect(configuredSocialProviders({
      GOOGLE_OAUTH_ENABLED: "true",
      GOOGLE_CLIENT_ID: "test-google-client",
      GOOGLE_CLIENT_SECRET: "test-google-secret",
    })).toEqual({
      google: {
        clientId: "test-google-client",
        clientSecret: "test-google-secret",
      },
    });
  });

  it.each([
    { GOOGLE_OAUTH_ENABLED: "true" },
    { GOOGLE_OAUTH_ENABLED: "true", GOOGLE_CLIENT_ID: "client" },
    { GOOGLE_OAUTH_ENABLED: "true", GOOGLE_CLIENT_SECRET: "secret" },
    {
      GOOGLE_OAUTH_ENABLED: "true",
      GOOGLE_CLIENT_ID: "   ",
      GOOGLE_CLIENT_SECRET: "secret",
    },
  ])("rejects incomplete credentials when enabled: %o", (environment) => {
    expect(() => configuredSocialProviders(environment)).toThrow(
      "Google OAuth enabled but client credentials are missing",
    );
  });

  it.each(["TRUE", "1", "yes", "enabled", "False"])(
    "rejects invalid enablement flag %s",
    (flag) => {
      expect(() => configuredSocialProviders({ GOOGLE_OAUTH_ENABLED: flag })).toThrow(
        "GOOGLE_OAUTH_ENABLED must be 'true' or 'false'",
      );
    },
  );

  it("never includes credentials in a validation error", () => {
    const secret = "do-not-log-this-secret";
    let message = "";
    try {
      configuredSocialProviders({
        GOOGLE_OAUTH_ENABLED: "true",
        GOOGLE_CLIENT_ID: secret,
        GOOGLE_CLIENT_SECRET: " ",
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).not.toContain(secret);
  });
});
