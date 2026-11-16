import { describe, expect, it } from "vitest";

import {
  clearPendingGoogleLink,
  consumeGoogleLinkReturn,
  evaluateGoogleLinkReturn,
  googleLinkCallbackURL,
  googleLinkErrorMessage,
  savePendingGoogleLink,
} from "../../../src/modules/auth/application/accountLinkCallback";

function storage() {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
    removeItem: (key: string) => { entries.delete(key); },
  };
}

describe("Google linking callback", () => {
  it("builds the callback URL", () => {
    expect(googleLinkCallbackURL("https://test.sisukas.eu/")).toBe("https://test.sisukas.eu/?account_link=google");
  });

  it("requires a user before recording a pending link", () => {
    expect(() => savePendingGoogleLink(storage(), "")).toThrow();
  });

  it("consumes a linking callback and preserves unrelated URL parts", () => {
    const s = storage();
    savePendingGoogleLink(s, "user-123");
    const result = consumeGoogleLinkReturn(new URL("https://test.sisukas.eu/?account_link=google&error=access_denied&error_description=private&view=calendar#week"), s);
    expect(result).toEqual({
      result: { originalUserId: "user-123", errorCode: "access_denied" },
      cleanUrl: "/?view=calendar#week",
    });
    expect(s.getItem("sisukas:google-link-pending")).toBeNull();
  });

  it("does not consume an ordinary sign-in callback", () => {
    const s = storage();
    savePendingGoogleLink(s, "user-123");
    expect(consumeGoogleLinkReturn(new URL("https://test.sisukas.eu/?error=account_not_linked"), s).result).toBeNull();
    expect(s.getItem("sisukas:google-link-pending")).toBe("user-123");
    clearPendingGoogleLink(s);
    expect(s.getItem("sisukas:google-link-pending")).toBeNull();
  });

  it("does not infer a prior authenticated identity from URL parameters", () => {
    const result = consumeGoogleLinkReturn(new URL("https://test.sisukas.eu/?account_link=google"), storage());
    expect(result.result?.originalUserId).toBeNull();
  });

  it("requires matching identity and server-confirmed association before success", () => {
    const callback = { originalUserId: "user-123", errorCode: null };
    expect(evaluateGoogleLinkReturn(callback, "user-456", true).success).toBe(false);
    expect(evaluateGoogleLinkReturn(callback, "user-123", false).success).toBe(false);
    expect(evaluateGoogleLinkReturn({ ...callback, errorCode: "access_denied" }, "user-123", true).success).toBe(false);
    expect(evaluateGoogleLinkReturn(callback, "user-123", true).success).toBe(true);
  });

  it("maps conflicts and unknown codes without exposing raw error descriptions", () => {
    expect(googleLinkErrorMessage("account_already_linked_to_different_user")).toContain("another Sisukas account");
    expect(googleLinkErrorMessage("unknown")).toContain("could not be completed");
  });
});
