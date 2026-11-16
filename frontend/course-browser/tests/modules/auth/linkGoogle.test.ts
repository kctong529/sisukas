import { beforeEach, describe, expect, it, vi } from "vitest";

const { linkSocial } = vi.hoisted(() => ({ linkSocial: vi.fn() }));
vi.mock("../../../src/modules/auth/infrastructure/authClient", () => ({
  authClient: { linkSocial },
}));

import { linkGoogle } from "../../../src/modules/auth/application/linkGoogle";

beforeEach(() => linkSocial.mockReset());

describe("explicit Google linking", () => {
  it("uses authenticated linkSocial with both callbacks", async () => {
    const result = { data: { url: "https://accounts.google.com" }, error: null };
    linkSocial.mockResolvedValue(result);
    await expect(linkGoogle("https://test.sisukas.eu/?account_link=google")).resolves.toBe(result);
    expect(linkSocial).toHaveBeenCalledExactlyOnceWith({
      provider: "google",
      callbackURL: "https://test.sisukas.eu/?account_link=google",
      errorCallbackURL: "https://test.sisukas.eu/?account_link=google",
    });
  });
});
