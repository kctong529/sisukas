import { describe, expect, it } from "vitest";

import { parseOAuthCallbackError } from "../../../src/modules/auth/application/oauthCallbackError";

describe("OAuth callback errors", () => {
  it("explains account_not_linked and removes error parameters", () => {
    const result = parseOAuthCallbackError(new URL(
      "https://test.sisukas.eu/?error=account_not_linked&error_description=private%20details#view",
    ));
    expect(result.error?.code).toBe("account_not_linked");
    expect(result.error?.message).toContain("Sign in with an email link");
    expect(result.cleanUrl).toBe("/#view");
  });

  it("handles cancellation without displaying untrusted provider details", () => {
    const result = parseOAuthCallbackError(new URL(
      "https://test.sisukas.eu/?error=access_denied&error_description=SECRET",
    ));
    expect(result.error?.message).toContain("cancelled");
    expect(result.error?.message).not.toContain("SECRET");
  });

  it("handles unknown codes safely", () => {
    const result = parseOAuthCallbackError(new URL("https://test.sisukas.eu/?error=<script>"));
    expect(result.error?.message).toContain("could not be completed");
    expect(result.error?.message).not.toContain("script");
  });

  it("preserves unrelated query parameters and fragments", () => {
    const result = parseOAuthCallbackError(new URL(
      "https://test.sisukas.eu/?utm_source=google&error=state_invalid#courses",
    ));
    expect(result.cleanUrl).toBe("/?utm_source=google#courses");
  });

  it("does not modify URLs without OAuth errors", () => {
    const result = parseOAuthCallbackError(new URL("https://test.sisukas.eu/?course=123#calendar"));
    expect(result.error).toBeNull();
    expect(result.cleanUrl).toBe("/?course=123#calendar");
  });
});
