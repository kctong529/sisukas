import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { plansService } from "@infrastructure/services/PlansService";
import { plansStore } from "@lib/stores/plansStore.svelte";

import type { Plan } from "@domain/models/Plan";

function plan(id: string): Plan {
  return {
    id,
    userId: "test-user",
    name: id,
    isActive: true,
    instanceIds: [],
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

beforeEach(() => {
  plansStore.actions.clear();
});

afterEach(() => {
  plansStore.actions.clear();
  vi.restoreAllMocks();
});

describe("plansStore loading lifecycle", () => {
  it("shares concurrent loading operations", async () => {
    const pending = deferred<Plan[]>();
    const loadAll = vi.spyOn(plansService, "loadAll")
      .mockReturnValue(pending.promise);

    const first = plansStore.actions.ensureLoaded();
    const second = plansStore.actions.ensureLoaded();

    expect(loadAll).toHaveBeenCalledOnce();
    expect(plansStore.state.loading).toBe(true);

    pending.resolve([plan("first")]);

    await Promise.all([first, second]);

    expect(plansStore.state.loaded).toBe(true);
    expect(plansStore.state.loading).toBe(false);
    expect(plansStore.state.activePlanId).toBe("first");
  });

  it("ignores loading results after clear", async () => {
    const pending = deferred<Plan[]>();

    vi.spyOn(plansService, "loadAll")
      .mockReturnValue(pending.promise);

    const loading = plansStore.actions.ensureLoaded();

    plansStore.actions.clear();

    pending.resolve([plan("obsolete")]);
    await loading;

    expect(plansStore.state.loaded).toBe(false);
    expect(plansStore.state.loading).toBe(false);
    expect(plansStore.read.getAll()).toEqual([]);
    expect(plansStore.state.activePlanId).toBeNull();
  });

  it("does not let an old response replace a newer load", async () => {
    const oldRequest = deferred<Plan[]>();
    const newRequest = deferred<Plan[]>();

    vi.spyOn(plansService, "loadAll")
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);

    const oldLoading = plansStore.actions.ensureLoaded();

    plansStore.actions.clear();

    const newLoading = plansStore.actions.ensureLoaded();

    oldRequest.resolve([plan("old")]);
    await oldLoading;

    expect(plansStore.state.loading).toBe(true);
    expect(plansStore.state.loaded).toBe(false);

    newRequest.resolve([plan("new")]);
    await newLoading;

    expect(plansStore.state.loaded).toBe(true);
    expect(plansStore.state.activePlanId).toBe("new");
    expect(plansStore.read.getById("old")).toBeNull();
  });

  it("ignores errors from an obsolete load", async () => {
    const pending = deferred<Plan[]>();

    vi.spyOn(plansService, "loadAll")
      .mockReturnValue(pending.promise);

    const loading = plansStore.actions.ensureLoaded();

    plansStore.actions.clear();

    pending.reject(new Error("Old session failed"));
    await loading;

    expect(plansStore.state.error).toBeNull();
    expect(plansStore.state.loaded).toBe(false);
  });

  it("records current failures and permits retry", async () => {
    const loadAll = vi.spyOn(plansService, "loadAll")
      .mockRejectedValueOnce(new Error("Network failure"))
      .mockResolvedValueOnce([plan("recovered")]);

    await expect(
      plansStore.actions.ensureLoaded(),
    ).rejects.toThrow("Network failure");

    expect(plansStore.state.error).toBe("Network failure");
    expect(plansStore.state.loading).toBe(false);

    await plansStore.actions.ensureLoaded();

    expect(loadAll).toHaveBeenCalledTimes(2);
    expect(plansStore.state.loaded).toBe(true);
    expect(plansStore.state.error).toBeNull();
  });

  it("does not activate a default plan created after clear", async () => {
    const pending = deferred<Plan>();

    vi.spyOn(plansService, "loadAll")
      .mockResolvedValue([]);

    vi.spyOn(plansService, "create")
      .mockReturnValue(pending.promise);

    const setActive = vi.spyOn(plansService, "setActive");

    const initialization = plansStore.actions.ensureDefaultPlan();

    // Allow ensureLoaded to finish and default creation to begin.
    await vi.waitFor(() => {
      expect(plansService.create).toHaveBeenCalledOnce();
    });

    plansStore.actions.clear();

    pending.resolve(plan("obsolete"));

    await expect(initialization).rejects.toThrow(
      "Plan operation invalidated by store reset",
    );

    expect(setActive).not.toHaveBeenCalled();
    expect(plansStore.read.getAll()).toEqual([]);
    expect(plansStore.state.error).toBeNull();
  });

  it("does not restore a plan from an obsolete create", async () => {
    const pending = deferred<Plan>();

    vi.spyOn(plansService, "create")
      .mockReturnValue(pending.promise);

    const creation = plansStore.actions.create("Default");

    plansStore.actions.clear();
    pending.resolve(plan("obsolete"));

    await expect(creation).rejects.toThrow(
      "Plan operation invalidated by store reset",
    );

    expect(plansStore.read.getById("obsolete")).toBeNull();
    expect(plansStore.state.error).toBeNull();
  });

  it("does not activate a plan after clear", async () => {
    const pending = deferred<Plan>();

    vi.spyOn(plansService, "setActive")
      .mockReturnValue(pending.promise);

    const activation = plansStore.actions.setActive("obsolete");

    plansStore.actions.clear();
    pending.resolve(plan("obsolete"));

    await expect(activation).rejects.toThrow(
      "Plan operation invalidated by store reset",
    );

    expect(plansStore.state.activePlanId).toBeNull();
    expect(plansStore.read.getById("obsolete")).toBeNull();
  });

  it("does not let old initialization clear newer work", async () => {
    const oldCreate = deferred<Plan>();
    const newCreate = deferred<Plan>();

    vi.spyOn(plansService, "loadAll")
      .mockResolvedValue([]);

    vi.spyOn(plansService, "create")
      .mockReturnValueOnce(oldCreate.promise)
      .mockReturnValueOnce(newCreate.promise);

    vi.spyOn(plansService, "setActive")
      .mockImplementation(async id => plan(id));

    const oldInitialization = plansStore.actions.ensureDefaultPlan();

    await vi.waitFor(() => {
      expect(plansService.create).toHaveBeenCalledTimes(1);
    });

    plansStore.actions.clear();

    const newInitialization = plansStore.actions.ensureDefaultPlan();

    await vi.waitFor(() => {
      expect(plansService.create).toHaveBeenCalledTimes(2);
    });

    oldCreate.resolve(plan("old"));

    await expect(oldInitialization).rejects.toThrow(
      "Plan operation invalidated by store reset",
    );

    // A third caller should join the new initialization.
    const joinedInitialization = plansStore.actions.ensureDefaultPlan();

    expect(plansService.create).toHaveBeenCalledTimes(2);

    newCreate.resolve(plan("new"));

    await Promise.all([newInitialization, joinedInitialization]);

    expect(plansStore.state.activePlanId).toBe("new");
    expect(plansStore.read.getById("old")).toBeNull();
  });
});
