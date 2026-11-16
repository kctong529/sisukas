import { beforeEach, describe, expect, it, vi } from "vitest";

const { listAccounts } = vi.hoisted(() => ({ listAccounts: vi.fn() }));
vi.mock("../../../src/modules/auth/infrastructure/authClient", () => ({
  authClient: { listAccounts },
}));

import {
  getConnectedMethods,
  summarizeConnectedMethods,
} from "../../../src/modules/auth/application/connectedMethods";

beforeEach(() => listAccounts.mockReset());

describe("connected sign-in methods", () => {
  it("treats zero account associations as no connected Google provider", () => {
    expect(summarizeConnectedMethods([])).toEqual({ googleConnected: false });
  });

  it("recognizes an existing Google association", () => {
    expect(summarizeConnectedMethods([{ providerId: "google" }])).toEqual({
      googleConnected: true,
    });
  });

  it("does not mistake other providers for Google", () => {
    expect(summarizeConnectedMethods([{ providerId: "github" }])).toEqual({
      googleConnected: false,
    });
  });

  it("loads account associations via Better Auth", async () => {
    listAccounts.mockResolvedValue({
      data: [{ providerId: "google" }],
      error: null,
    });
    await expect(getConnectedMethods()).resolves.toEqual({ googleConnected: true });
    expect(listAccounts).toHaveBeenCalledOnce();
  });

  it("preserves an empty successful result", async () => {
    listAccounts.mockResolvedValue({ data: [], error: null });
    await expect(getConnectedMethods()).resolves.toEqual({ googleConnected: false });
  });

  it("rejects API failures rather than showing an unconnected status", async () => {
    listAccounts.mockResolvedValue({ data: null, error: { message: "Unauthorized" } });
    await expect(getConnectedMethods()).rejects.toThrow(
      "Could not load connected sign-in methods.",
    );
  });

  it("rejects missing account data", async () => {
    listAccounts.mockResolvedValue({ data: null, error: null });
    await expect(getConnectedMethods()).rejects.toThrow(
      "Could not load connected sign-in methods.",
    );
  });
});
