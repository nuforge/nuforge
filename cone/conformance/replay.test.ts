import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMemoryEventStore,
  establishProposal,
  proposeBulk,
  proposeInteraction,
  replay,
  RESOLUTION_SEMANTICS,
  totalCount,
  type ProvenanceRef
} from "../index";

const provenance: readonly ProvenanceRef[] = [
  { id: "prov-1", source: "scenario" }
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("NF-C12 deterministic replay", () => {
  it("reproduces established state from the same history and recorded draw", () => {
    vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("clock");
    });
    vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("random");
    });

    const store = createMemoryEventStore();
    const bulk = mustPropose(
      proposeBulk({
        eventId: "bulk-1",
        bulkId: "container",
        count: 100,
        tallies: [{ marker: "X", exactly: 10 }],
        scopeId: "scope-1",
        occurredAt: "t-later",
        provenance
      })
    );
    expect(establishProposal(store, bulk, "accept").accepted).toBe(true);
    const initial = mustReplay(store.list());
    const first = mustPropose(
      proposeInteraction({
        eventId: "interaction-1",
        representation: initial,
        fromBulkId: "container",
        takeMarker: "X",
        addMark: "Y",
        draw: 0,
        scopeId: "scope-1",
        occurredAt: "t-earlier",
        provenance,
        parents: ["bulk-1"]
      })
    );
    const second = mustPropose(
      proposeInteraction({
        eventId: "interaction-1",
        representation: initial,
        fromBulkId: "container",
        takeMarker: "X",
        addMark: "Y",
        draw: 0,
        scopeId: "scope-1",
        occurredAt: "t-earlier",
        provenance,
        parents: ["bulk-1"]
      })
    );
    expect(second).toEqual(first);
    expect(first.nondeterminism).toEqual([{ id: "selection", value: 0 }]);
    expect(first.semantics).toEqual([RESOLUTION_SEMANTICS]);
    expect(establishProposal(store, first, "accept").accepted).toBe(true);

    const left = mustReplay(store.list());
    const right = mustReplay(store.list());
    expect(right).toEqual(left);
    expect(left.individuals.map(individual => individual.id)).toEqual([
      "selected:0"
    ]);
    expect(totalCount(left)).toBe(100);

    const otherDraw = mustPropose(
      proposeInteraction({
        eventId: "interaction-2",
        representation: initial,
        fromBulkId: "container",
        takeMarker: "X",
        addMark: "Y",
        draw: 1,
        scopeId: "scope-1",
        occurredAt: "t-earlier",
        provenance,
        parents: ["bulk-1"]
      })
    );
    expect(otherDraw.payload).not.toEqual(first.payload);
  });

  it("rejects a child placed before its parent and foreign semantics", () => {
    const bulk = mustPropose(
      proposeBulk({
        eventId: "bulk-1",
        bulkId: "container",
        count: 100,
        tallies: [{ marker: "X", exactly: 10 }],
        scopeId: "scope-1",
        occurredAt: "t0",
        provenance
      })
    );
    const initial = mustReplay([bulk]);
    const interaction = mustPropose(
      proposeInteraction({
        eventId: "interaction-1",
        representation: initial,
        fromBulkId: "container",
        takeMarker: "X",
        addMark: "Y",
        continuityId: "established-unit",
        scopeId: "scope-1",
        occurredAt: "t1",
        provenance,
        parents: ["bulk-1"]
      })
    );
    expect(replay([interaction, bulk])).toEqual({
      ok: false,
      reason: "unordered-parent"
    });
    expect(
      replay([{ ...bulk, semantics: [{ id: "other", version: "9" }] }])
    ).toEqual({ ok: false, reason: "unsupported-semantics" });
  });
});

function mustPropose<T extends { readonly ok: boolean }>(
  result: T
): T extends { readonly ok: true; readonly event: infer Event }
  ? Event
  : never {
  expect(result.ok).toBe(true);
  if (!result.ok || !("event" in result)) throw new Error("proposal");
  return result.event as never;
}

function mustReplay(events: Parameters<typeof replay>[0]) {
  const result = replay([...events]);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.reason);
  return result.representation;
}
