import { describe, expect, it } from "vitest";
import { accountLinkingPolicy } from "../../src/modules/auth/config/accountLinkingPolicy";

describe("account-linking security defaults (#215)", () => {
  it("allows deliberate linking but never implicit same-email linking", () => {
    expect(accountLinkingPolicy.enabled).toBe(true);
    expect(accountLinkingPolicy.disableImplicitLinking).toBe(true);
  });

  it("requires matching provider and local emails", () => {
    expect(accountLinkingPolicy.allowDifferentEmails).toBe(false);
  });

  it("does not permit unlinking all provider accounts", () => {
    expect(accountLinkingPolicy.allowUnlinkingAll).toBe(false);
  });

  it("does not replace existing profile details during linking", () => {
    expect(accountLinkingPolicy.updateUserInfoOnLink).toBe(false);
  });
});
