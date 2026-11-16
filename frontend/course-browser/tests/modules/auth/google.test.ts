import { beforeEach, describe, expect, it, vi } from "vitest";

const { social } = vi.hoisted(() => ({ social: vi.fn() }));
vi.mock("../../../src/modules/auth/infrastructure/authClient", () => ({
  authClient: { signIn: { social } },
}));

import { signInWithGoogle } from "../../../src/modules/auth/application/google";
import { isGoogleSignInEnabled } from "../../../src/modules/auth/config/availableMethods";

beforeEach(() => social.mockReset());

describe("Google sign-in method", () => {
  it("delegates to Better Auth with the Google provider and callback URL", async () => {
    const result = { data: { url: "https://accounts.google.com/" }, error: null };
    social.mockResolvedValue(result);

    await expect(signInWithGoogle("https://test.sisukas.eu/")).resolves.toBe(result);
    expect(social).toHaveBeenCalledExactlyOnceWith({
      provider: "google",
      callbackURL: "https://test.sisukas.eu/",
    });
  });

  it("propagates Better Auth sign-in errors unchanged", async () => {
    const result = { data: null, error: { message: "provider_disabled" } };
    social.mockResolvedValue(result);
    await expect(signInWithGoogle("https://test.sisukas.eu/")).resolves.toBe(result);
  });

  it.each([
    [undefined, false],
    ["", false],
    ["false", false],
    ["TRUE", false],
    ["1", false],
    ["true", true],
  ])("only enables the Google button with literal true: %s", (flag, expected) => {
    expect(isGoogleSignInEnabled(flag)).toBe(expected);
  });
});
