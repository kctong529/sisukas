import { describe, expect, it } from "vitest";

import { authContextTransition } from "@app/auth/authContextTransition";

describe("authContextTransition", () => {
  it("ignores an unresolved initial session", () => {
    expect(authContextTransition(undefined, true, null)).toBeNull();
    expect(authContextTransition(undefined, true, "user-a")).toBeNull();
  });

  it("distinguishes initial settled sign-out from an unobserved session", () => {
    expect(authContextTransition(undefined, false, null)).toEqual({
      previous: undefined,
      current: null,
    });
  });

  it("recognizes initial authentication", () => {
    expect(authContextTransition(undefined, false, "user-a")).toEqual({
      previous: undefined,
      current: "user-a",
    });
  });

  it("does not reinitialize an unchanged account", () => {
    expect(authContextTransition("user-a", false, "user-a")).toBeNull();
    expect(authContextTransition(null, false, null)).toBeNull();
  });

  it("does not interpret temporary pending state as logout", () => {
    expect(authContextTransition("user-a", true, null)).toBeNull();
    expect(authContextTransition("user-a", true, "user-a")).toBeNull();
  });

  it("recognizes logout and direct account switching", () => {
    expect(authContextTransition("user-a", false, null)).toEqual({
      previous: "user-a",
      current: null,
    });
    expect(authContextTransition("user-a", false, "user-b")).toEqual({
      previous: "user-a",
      current: "user-b",
    });
    expect(authContextTransition(null, false, "user-b")).toEqual({
      previous: null,
      current: "user-b",
    });
  });
});
