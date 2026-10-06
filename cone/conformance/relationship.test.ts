import { describe, expect, it } from "vitest";
import { createMemoryEventStore, createRelationship } from "../index";

describe("relationship contract", () => {
  it("records an attributable relation without admitting an event", () => {
    const store = createMemoryEventStore();
    const created = createRelationship({
      id: "rel-1",
      type: "linked",
      refs: ["left", "right"],
      scope: { id: "scope-1" },
      provenance: [{ id: "prov-1", source: "declaration" }]
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.relationship.refs).toEqual(["left", "right"]);
    expect(store.list()).toEqual([]);
    expect(JSON.parse(JSON.stringify(created.relationship))).toEqual(
      created.relationship
    );
  });

  it("keeps a copy independent of the caller's arrays", () => {
    const refs = ["left", "right"];
    const created = createRelationship({
      id: "rel-1",
      type: "linked",
      refs,
      scope: { id: "scope-1" },
      provenance: [{ id: "prov-1", source: "declaration" }]
    });
    refs.push("later");

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.relationship.refs).toEqual(["left", "right"]);
  });

  it("rejects a relation with no provenance", () => {
    expect(
      createRelationship({
        id: "rel-1",
        type: "linked",
        refs: ["left"],
        scope: { id: "scope-1" },
        provenance: []
      })
    ).toEqual({ ok: false, reason: "missing-provenance" });
  });
});
