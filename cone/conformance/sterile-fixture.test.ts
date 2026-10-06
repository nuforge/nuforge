import { describe, expect, it } from "vitest";
import {
  coarsen,
  constrain,
  continuityStatus,
  countMarker,
  countMarkerEvaluator,
  createConstraintRegistry,
  createMemoryEventStore,
  establishProposal,
  evaluateIdentity,
  evaluateOneMarked,
  mergeBulks,
  proposeBulk,
  proposeInteraction,
  refine,
  replay,
  sameContinuity,
  sameCounts,
  sameIdentities,
  totalCount,
  type ProvenanceRef,
  type Representation
} from "../index";

const provenance: readonly ProvenanceRef[] = [
  { id: "prov-1", source: "scenario" }
];

describe("sterile fixture", () => {
  it("conserves totals, keeps one causal identity, and drops query identities", () => {
    const store = createMemoryEventStore();
    const bulk = proposeBulk({
      eventId: "bulk-1",
      bulkId: "container",
      count: 100,
      tallies: [{ marker: "X", exactly: 10 }],
      scopeId: "scope-1",
      occurredAt: "t0",
      provenance
    });
    expect(bulk.ok).toBe(true);
    if (!bulk.ok) return;
    expect(establishProposal(store, bulk.event, "accept").accepted).toBe(true);

    const initial = folded(store.list());
    expect(totalCount(initial)).toBe(100);
    expect(countOf(initial, "X")).toBe(10);
    expect(countMarker(initial, "Y", provenance).kind).toBe("insufficient");

    const queried = evaluateOneMarked(initial, {
      queryId: "need-one-x",
      bulkId: "container",
      marker: "X",
      continuityId: "query-unit",
      provenance
    });
    expect(queried.ok).toBe(true);
    if (!queried.ok) return;
    expect(queried.evaluation.kind).toBe("sufficient");
    expect(store.list()).toHaveLength(1);
    expect(continuityStatus(initial, store.list(), "query-unit")).toBe(
      "never-established"
    );
    expect(continuityStatus(queried.working, store.list(), "query-unit")).toBe(
      "ephemeral"
    );
    expect(sameCounts(initial, queried.working)).toBe(true);
    expect(sameIdentities(initial, queried.working)).toBe(true);

    const unrelated = evaluateOneMarked(initial, {
      queryId: "unrelated",
      bulkId: "container",
      marker: "X",
      continuityId: "unrelated-unit",
      provenance
    });
    expect(unrelated.ok).toBe(true);
    const coarsened = unrelated.ok ? coarsen(unrelated.working) : undefined;
    expect(coarsened?.ok).toBe(true);
    if (!coarsened?.ok) return;
    expect(coarsened.representation.individuals).toEqual([]);
    expect(sameCounts(initial, coarsened.representation)).toBe(true);

    const proposal = proposeInteraction({
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
    });
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    expect(establishProposal(store, proposal.event, "reject")).toEqual({
      accepted: false,
      reason: "rejected"
    });
    expect(store.list()).toHaveLength(1);

    expect(countOf(initial, "X")).toBe(10);
    expect(store.list()).toHaveLength(1);

    expect(establishProposal(store, proposal.event, "accept").accepted).toBe(
      true
    );
    const established = folded(store.list());
    const kept = coarsen(established);
    expect(kept.ok).toBe(true);
    if (!kept.ok) return;

    expect(
      kept.representation.individuals.map(individual => individual.id)
    ).toEqual(["established-unit"]);
    expect(kept.representation.individuals[0]?.marks).toEqual(["X", "Y"]);
    expect(kept.representation.individuals[0]?.established).toBe(true);
    const residual = kept.representation.bulks.find(
      bulk => bulk.id === "container"
    );
    expect(residual?.count).toBe(99);
    expect(residual?.constraints).toEqual([
      {
        id: "container:X",
        kind: "count-marker",
        version: "1",
        parameters: { marker: "X", exactly: 9 }
      }
    ]);
    expect(totalCount(kept.representation)).toBe(100);
    expect(countOf(kept.representation, "X")).toBe(10);
    expect(countOf(kept.representation, "Y")).toBe(1);
    expect(
      continuityStatus(established, store.list(), "established-unit")
    ).toBe("active");
    expect(continuityStatus(established, store.list(), "query-unit")).toBe(
      "never-established"
    );
    expect(continuityStatus(established, store.list(), "unrelated-unit")).toBe(
      "never-established"
    );
    expect(
      continuityStatus(
        { individuals: [], bulks: established.bulks },
        store.list(),
        "established-unit"
      )
    ).toBe("recoverable");

    const claim = residual?.constraints[0];
    expect(claim).toBeDefined();
    if (claim === undefined) return;
    const registry = createConstraintRegistry();
    expect(registry.register(countMarkerEvaluator()).registered).toBe(true);
    expect(registry.inspect(claim)).toEqual({
      ok: true,
      descriptor: {
        id: "container:X",
        kind: "count-marker",
        version: "1",
        summary: "exactly 9 have X"
      }
    });
  });

  it("treats count equivalence and identity as different questions", () => {
    const initial = folded([containerEvent()]);
    const refined = refine(initial, {
      bulkId: "container",
      marker: "X",
      continuityId: "temp-a"
    });
    const other = refine(initial, {
      bulkId: "container",
      marker: "X",
      continuityId: "temp-b"
    });
    expect(refined.ok && other.ok).toBe(true);
    if (!refined.ok || !other.ok) return;

    expect(sameCounts(initial, refined.representation)).toBe(true);
    expect(sameCounts(refined.representation, other.representation)).toBe(true);
    expect(sameContinuity({ id: "temp-a" }, { id: "temp-b" })).toBe(false);
    expect(
      evaluateIdentity(refined.representation, "temp-a", provenance)
    ).toMatchObject({
      kind: "sufficient",
      value: { value: { present: true, established: false } }
    });
    expect(
      evaluateIdentity(other.representation, "temp-a", provenance)
    ).toMatchObject({
      value: { value: { present: false, established: false } }
    });
    expect(sameIdentities(initial, refined.representation)).toBe(true);
  });
});

describe("resolution operations", () => {
  it("merges bulks and rejects a conflicting constraint", () => {
    const initial = folded([containerEvent()]);
    const splitOff = proposeBulk({
      eventId: "bulk-2",
      bulkId: "other",
      count: 40,
      tallies: [{ marker: "X", exactly: 4 }],
      scopeId: "scope-1",
      occurredAt: "t0",
      provenance,
      parents: ["bulk-1"]
    });
    expect(splitOff.ok).toBe(true);
    if (!splitOff.ok) return;
    const mergedSource = folded([containerEvent(), splitOff.event]);
    const merged = mergeBulks(mergedSource, {
      leftId: "container",
      rightId: "other",
      intoId: "combined"
    });
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(totalCount(merged.representation)).toBe(140);
    expect(countOf(merged.representation, "X")).toBe(14);

    expect(
      constrain(initial, { bulkId: "container", marker: "X", exactly: 3 })
    ).toEqual({ ok: false, reason: "tally-conflict" });
    const added = constrain(initial, {
      bulkId: "container",
      marker: "Z",
      exactly: 2
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(countOf(added.representation, "Z")).toBe(2);
    expect(countMarker(initial, "Z", provenance).kind).toBe("insufficient");
  });

  it("refuses to refine a marker the parent does not have", () => {
    const initial = folded([containerEvent()]);
    expect(
      refine(initial, {
        bulkId: "container",
        marker: "Y",
        continuityId: "invented"
      })
    ).toEqual({ ok: false, reason: "marker-unavailable" });
    expect(totalCount(initial)).toBe(100);
    expect(countOf(initial, "X")).toBe(10);
  });
});

function containerEvent() {
  const proposed = proposeBulk({
    eventId: "bulk-1",
    bulkId: "container",
    count: 100,
    tallies: [{ marker: "X", exactly: 10 }],
    scopeId: "scope-1",
    occurredAt: "t0",
    provenance
  });
  if (!proposed.ok) throw new Error(proposed.reason);
  return proposed.event;
}

function folded(events: Parameters<typeof replay>[0]): Representation {
  const result = replay([...events]);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.reason);
  return result.representation;
}

function countOf(rep: Representation, name: string): number {
  const evaluated = countMarker(rep, name, provenance);
  if (evaluated.kind !== "sufficient") throw new Error(name);
  return evaluated.value.value;
}
