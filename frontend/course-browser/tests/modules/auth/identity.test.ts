import { describe, expect, it } from "vitest";

import { canonicalUserId } from "../../../src/modules/auth/application/identity";

describe("canonical Sisukas identity", () => {
  it("does not infer a user ID without an authenticated user", () => {
    expect(canonicalUserId(null)).toBeNull();
    expect(canonicalUserId({})).toBeNull();
  });

  it("uses the application user ID rather than provider or session IDs", () => {
    expect(canonicalUserId({ user: { id: "sisukas-user-123" } })).toBe("sisukas-user-123");
  });
});
