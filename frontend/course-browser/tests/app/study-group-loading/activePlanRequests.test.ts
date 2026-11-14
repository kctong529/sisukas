import { describe, expect, it, vi } from "vitest";

import { activePlanStudyGroupRequests } from
  "@app/study-group-loading/activePlanRequests";

describe("activePlanStudyGroupRequests", () => {
  it("returns no requests for an empty plan", () => {
    const resolve = vi.fn();

    const requests = activePlanStudyGroupRequests(
      { instanceIds: [] },
      resolve,
    );

    expect(requests).toEqual([]);
    expect(resolve).not.toHaveBeenCalled();
  });

  it("maps an offering to its course unit", () => {
    const requests = activePlanStudyGroupRequests(
      { instanceIds: ["offering-a"] },
      () => ({ unitId: "unit-a" }),
    );

    expect(requests).toEqual([
      {
        courseUnitId: "unit-a",
        courseOfferingId: "offering-a",
      },
    ]);
  });

  it("deduplicates offering IDs before resolution", () => {
    const resolve = vi.fn(() => ({ unitId: "unit-a" }));

    const requests = activePlanStudyGroupRequests(
      { instanceIds: ["offering-a", "offering-a"] },
      resolve,
    );

    expect(requests).toHaveLength(1);
    expect(resolve).toHaveBeenCalledOnce();
    expect(resolve).toHaveBeenCalledWith("offering-a");
  });

  it("preserves plan membership order", () => {
    const units: Record<string, string> = {
      "offering-b": "unit-b",
      "offering-a": "unit-a",
    };

    const requests = activePlanStudyGroupRequests(
      { instanceIds: ["offering-b", "offering-a"] },
      id => ({ unitId: units[id] }),
    );

    expect(requests).toEqual([
      {
        courseUnitId: "unit-b",
        courseOfferingId: "offering-b",
      },
      {
        courseUnitId: "unit-a",
        courseOfferingId: "offering-a",
      },
    ]);
  });

  it("keeps different offerings of the same course unit", () => {
    const requests = activePlanStudyGroupRequests(
      { instanceIds: ["offering-a", "offering-b"] },
      () => ({ unitId: "shared-unit" }),
    );

    expect(requests).toEqual([
      {
        courseUnitId: "shared-unit",
        courseOfferingId: "offering-a",
      },
      {
        courseUnitId: "shared-unit",
        courseOfferingId: "offering-b",
      },
    ]);
  });

  it("omits unresolved offerings without losing resolved ones", () => {
    const resolve = vi.fn((id: string) =>
      id === "offering-b"
        ? undefined
        : { unitId: `unit-${id}` },
    );

    const requests = activePlanStudyGroupRequests(
      {
        instanceIds: [
          "offering-a",
          "offering-b",
          "offering-c",
        ],
      },
      resolve,
    );

    expect(requests.map(request => request.courseOfferingId))
      .toEqual(["offering-a", "offering-c"]);

    expect(resolve).toHaveBeenCalledTimes(3);
  });

  it("allows a previously unresolved offering to resolve later", () => {
    const plan = { instanceIds: ["offering-a"] };

    expect(
      activePlanStudyGroupRequests(plan, () => undefined),
    ).toEqual([]);

    expect(
      activePlanStudyGroupRequests(
        plan,
        () => ({ unitId: "unit-a" }),
      ),
    ).toEqual([
      {
        courseUnitId: "unit-a",
        courseOfferingId: "offering-a",
      },
    ]);
  });

  it("does not mutate plan membership", () => {
    const instanceIds = Object.freeze([
      "offering-b",
      "offering-a",
      "offering-b",
    ]);

    const plan = {
      instanceIds: [...instanceIds],
    };

    const original = [...plan.instanceIds];

    activePlanStudyGroupRequests(
      plan,
      () => ({ unitId: "unit" }),
    );

    expect(plan.instanceIds).toEqual(original);
  });
});
