import { describe, expect, it } from "vitest";
import { toAuthenticatedIdentity } from "../../src/modules/auth/domain/AuthenticatedIdentity";

describe("canonical authenticated identity", () => {
  it("returns null when unauthenticated", () => {
    expect(toAuthenticatedIdentity(null)).toBeNull();
  });

  it("retains the canonical user ID and not a provider identifier", () => {
    expect(toAuthenticatedIdentity({ id: "sisukas-user-123", email: "a@example.test", emailVerified: true }))
      .toEqual({ userId: "sisukas-user-123", email: "a@example.test", emailVerified: true });
  });
});
