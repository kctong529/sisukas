import { describe, expect, it, vi } from "vitest";

import { createAuthenticatedPlanLifecycle } from "@app/auth/authenticatedPlanLifecycle";

function deferred() {
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((_resolve, rej) => {
    reject = rej;
  });
  return { promise, reject };
}

function setup() {
  const actions = {
    clear: vi.fn(),
    ensureDefaultPlan: vi.fn(async () => {}),
  };
  const reportError = vi.fn();
  const lifecycle = createAuthenticatedPlanLifecycle(actions, reportError);
  return { actions, reportError, lifecycle };
}

describe("authenticated plan lifecycle", () => {
  it("does nothing until authentication is settled", () => {
    const { actions, lifecycle } = setup();
    lifecycle.update(true, null);
    lifecycle.update(true, "a");
    expect(actions.clear).not.toHaveBeenCalled();
    expect(actions.ensureDefaultPlan).not.toHaveBeenCalled();
  });

  it("establishes the initially signed-out context without loading", () => {
    const { actions, lifecycle } = setup();
    lifecycle.update(false, null);
    lifecycle.update(false, null);
    expect(actions.clear).toHaveBeenCalledOnce();
    expect(actions.ensureDefaultPlan).not.toHaveBeenCalled();
  });

  it("initializes exactly once for repeated observations of one account", () => {
    const { actions, lifecycle } = setup();
    lifecycle.update(false, "a");
    lifecycle.update(false, "a");
    lifecycle.update(true, null); // Transient unresolved session
    lifecycle.update(false, "a");
    expect(actions.clear).toHaveBeenCalledOnce();
    expect(actions.ensureDefaultPlan).toHaveBeenCalledOnce();
  });

  it("clears before initializing after logout and account switching", () => {
    const calls: string[] = [];
    const actions = {
      clear: vi.fn(() => { calls.push("clear"); }),
      ensureDefaultPlan: vi.fn(async () => { calls.push("load"); }),
    };
    const lifecycle = createAuthenticatedPlanLifecycle(actions);
    lifecycle.update(false, "a");
    lifecycle.update(false, "b");
    lifecycle.update(false, null);
    expect(calls).toEqual(["clear", "load", "clear", "load", "clear"]);
  });

  it("ignores obsolete errors but reports failures for the current account", async () => {
    const oldRequest = deferred();
    const newRequest = deferred();
    const { actions, reportError, lifecycle } = setup();
    actions.ensureDefaultPlan
      .mockImplementationOnce(() => oldRequest.promise)
      .mockImplementationOnce(() => newRequest.promise);
    lifecycle.update(false, "a");
    lifecycle.update(false, "b");
    oldRequest.reject(new Error("obsolete"));
    await Promise.resolve();
    expect(reportError).not.toHaveBeenCalled();
    newRequest.reject(new Error("current"));
    await Promise.resolve();
    expect(reportError).toHaveBeenCalledOnce();
    expect(reportError.mock.calls[0][0]).toEqual(new Error("current"));
  });
});
