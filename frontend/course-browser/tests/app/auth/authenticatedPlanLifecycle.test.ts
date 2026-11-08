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


describe("authenticated account data lifecycle", () => {
  function setupAccountData() {
    const calls: string[] = [];
    const plans = {
      clear: vi.fn(() => { calls.push("plans:clear"); }),
      ensureDefaultPlan: vi.fn(async () => { calls.push("plans:load"); }),
    };
    const favourites = {
      clear: vi.fn(() => { calls.push("favourites:clear"); }),
      load: vi.fn(async () => { calls.push("favourites:load"); }),
    };
    const grades = {
      clear: vi.fn(() => { calls.push("grades:clear"); }),
      load: vi.fn(async () => { calls.push("grades:load"); }),
    };
    const studyGroups = {
      clear: vi.fn(() => { calls.push("study-groups:clear"); }),
    };
    const errors = vi.fn();
    const lifecycle = createAuthenticatedPlanLifecycle(
      plans, errors, { favourites, grades, studyGroups },
    );
    return { lifecycle, plans, favourites, grades, studyGroups, errors, calls };
  }

  it("does not load any account-scoped data until authentication settles", () => {
    const { lifecycle, plans, favourites, grades } = setupAccountData();
    lifecycle.update(true, "a");
    expect(plans.clear).not.toHaveBeenCalled();
    expect(favourites.load).not.toHaveBeenCalled();
    expect(grades.load).not.toHaveBeenCalled();
  });

  it("clears all stores before initializing for each new account", () => {
    const { lifecycle, calls } = setupAccountData();
    lifecycle.update(false, "a");
    lifecycle.update(false, "a");
    lifecycle.update(true, null);
    lifecycle.update(false, "a");
    lifecycle.update(false, "b");
    expect(calls).toEqual([
      "plans:clear", "favourites:clear", "grades:clear", "study-groups:clear",
      "plans:load", "favourites:load", "grades:load",
      "plans:clear", "favourites:clear", "grades:clear", "study-groups:clear",
      "plans:load", "favourites:load", "grades:load",
    ]);
  });

  it("clears account data without reloading on confirmed logout", () => {
    const { lifecycle, calls } = setupAccountData();
    lifecycle.update(false, "a");
    calls.length = 0;
    lifecycle.update(false, null);
    expect(calls).toEqual([
      "plans:clear", "favourites:clear", "grades:clear", "study-groups:clear",
    ]);
  });

  it("does not report obsolete favourites and grades load failures", async () => {
    const { lifecycle, favourites, grades, errors } = setupAccountData();
    const oldFavourite = deferred();
    const oldGrade = deferred();
    favourites.load.mockImplementationOnce(() => oldFavourite.promise);
    grades.load.mockImplementationOnce(() => oldGrade.promise);
    lifecycle.update(false, "a");
    lifecycle.update(false, "b");
    oldFavourite.reject(new Error("old favourites"));
    oldGrade.reject(new Error("old grades"));
    await Promise.resolve();
    expect(errors).not.toHaveBeenCalled();
  });
});


describe("study-group cache authentication boundaries", () => {
  function setup() {
    const clear = vi.fn();
    const plans = { clear: vi.fn(), ensureDefaultPlan: vi.fn(async () => {}) };
    const favourites = { clear: vi.fn(), load: vi.fn(async () => {}) };
    const grades = { clear: vi.fn(), load: vi.fn(async () => {}) };
    const lifecycle = createAuthenticatedPlanLifecycle(
      plans, vi.fn(), { favourites, grades, studyGroups: { clear } },
    );
    return { lifecycle, clear };
  }

  it("does not clear either cache before session resolution", () => {
    const { lifecycle, clear } = setup();
    lifecycle.update(true, null);
    lifecycle.update(true, "user-a");
    expect(clear).not.toHaveBeenCalled();
  });

  it("clears on initial settled context, logout and direct account switch", () => {
    const { lifecycle, clear } = setup();
    lifecycle.update(false, "user-a");
    lifecycle.update(false, "user-b");
    lifecycle.update(false, null);
    expect(clear).toHaveBeenCalledTimes(3);
  });

  it("does not clear again on unchanged accounts or temporary pending state", () => {
    const { lifecycle, clear } = setup();
    lifecycle.update(false, "user-a");
    lifecycle.update(false, "user-a");
    lifecycle.update(true, null);
    lifecycle.update(false, "user-a");
    expect(clear).toHaveBeenCalledOnce();
  });
});
