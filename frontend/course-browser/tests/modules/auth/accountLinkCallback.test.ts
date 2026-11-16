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
    savePendingGoogleLink(s, "user-123", 1000);
    const result = consumeGoogleLinkReturn(new URL("https://test.sisukas.eu/?account_link=google&error=access_denied&error_description=private&view=calendar#week"), s, 2000);
    expect(result).toEqual({
      result: { originalUserId: "user-123", errorCode: "access_denied" },
      cleanUrl: "/?view=calendar#week",
    });
    expect(s.getItem("sisukas:google-link-pending")).toBeNull();
  });

  it("does not consume an ordinary sign-in callback", () => {
    const s = storage();
    savePendingGoogleLink(s, "user-123");
    const before = s.getItem("sisukas:google-link-pending");
    expect(consumeGoogleLinkReturn(new URL("https://test.sisukas.eu/?error=account_not_linked"), s).result).toBeNull();
    expect(s.getItem("sisukas:google-link-pending")).toBe(before);
    clearPendingGoogleLink(s);
    expect(s.getItem("sisukas:google-link-pending")).toBeNull();
  });

  it("rejects expired or future-dated linking markers", () => {
    for (const [createdAt, returnAt] of [[1000, 1000 + 16 * 60 * 1000], [2000, 1000]]) {
      const s = storage();
      savePendingGoogleLink(s, "user-123", createdAt);
      const parsed = consumeGoogleLinkReturn(
        new URL("https://test.sisukas.eu/?account_link=google"), s, returnAt,
      );
      expect(parsed.result?.originalUserId).toBeNull();
      expect(s.getItem("sisukas:google-link-pending")).toBeNull();
      expect(evaluateGoogleLinkReturn(parsed.result!, "user-123", true).success).toBe(false);
    }
  });

  it("rejects corrupt or legacy marker values and consumes them", () => {
    for (const value of ["user-123", "not-json", "{}", '{"originalUserId":"user-123"}']) {
      const s = storage();
      s.setItem("sisukas:google-link-pending", value);
      const parsed = consumeGoogleLinkReturn(
        new URL("https://test.sisukas.eu/?account_link=google"), s,
      );
      expect(parsed.result?.originalUserId).toBeNull();
      expect(s.getItem("sisukas:google-link-pending")).toBeNull();
    }
  });

  it("accepts a valid marker within the lifetime", () => {
    const s = storage();
    savePendingGoogleLink(s, "user-123", 1_000);
    const parsed = consumeGoogleLinkReturn(
      new URL("https://test.sisukas.eu/?account_link=google"), s, 1_000 + 14 * 60 * 1_000,
    );
    expect(evaluateGoogleLinkReturn(parsed.result!, "user-123", true).success).toBe(true);
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
    expect(evaluateGoogleLinkReturn({ ...callback, errorCode: "account_already_linked_to_different_user" }, "user-123", true).success).toBe(false);
    expect(evaluateGoogleLinkReturn({ ...callback, originalUserId: null }, "user-123", true).success).toBe(false);
  });

  it("explains email mismatch for either supported Better Auth error code", () => {
    for (const errorCode of ["email_doesn't_match", "email_does_not_match"]) {
      const result = evaluateGoogleLinkReturn(
        { originalUserId: "user-123", errorCode },
        "user-123",
        false,
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("different email address");
      expect(result.message).toContain("same email");
      expect(result.message).toContain("has not been changed");
    }
  });

  it("does not trust an email-mismatch callback without a verified linking identity", () => {
    const result = evaluateGoogleLinkReturn(
      { originalUserId: null, errorCode: "email_does_not_match" },
      "user-123",
      false,
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain("Could not verify the original account identity");
    expect(result.message).not.toContain("different email address");
  });

  it("maps conflicts and unknown codes without exposing raw error descriptions", () => {
    expect(googleLinkErrorMessage("account_already_linked_to_different_user")).toContain("another Sisukas account");
    expect(googleLinkErrorMessage("unknown")).toContain("could not be completed");
  });
});
