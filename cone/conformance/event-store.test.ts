import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryEventStore, type EventRecord } from "../index";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("in-memory event history", () => {
  it("admits provenance-bearing events in insertion order", () => {
    const store = createMemoryEventStore();
    const root = admit(store, event("root", [], { occurredAt: "2000-01-02" }));
    const child = admit(
      store,
      event("child", ["root"], { occurredAt: "2000-01-01" })
    );

    expect(store.list().map(item => item.id)).toEqual(["root", "child"]);
    expect(child.parents).toEqual(["root"]);
    expect(store.get("root")).toBe(root);
    expect(store.get("missing")).toBeUndefined();
  });

  it("does not impose a clock or a random source", () => {
    vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("clock");
    });
    vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("random");
    });
    const store = createMemoryEventStore();
    expect(store.append(event("root")).accepted).toBe(true);
  });

  it("leaves history unchanged when admission fails", () => {
    const store = createMemoryEventStore();
    admit(store, event("root"));
    const before = store.list();

    expect(store.append(event("root"))).toEqual({
      accepted: false,
      reason: "duplicate-id"
    });
    expect(store.append(event("orphan", ["missing"]))).toEqual({
      accepted: false,
      reason: "unknown-parent"
    });
    expect(store.append(event("loop", ["loop"]))).toEqual({
      accepted: false,
      reason: "self-parent"
    });
    expect(store.append({ ...event("bare"), provenance: [] })).toEqual({
      accepted: false,
      reason: "missing-provenance"
    });
    expect(store.append({ ...event("bare"), semantics: [] })).toEqual({
      accepted: false,
      reason: "missing-semantics"
    });
    expect(store.append({ ...event("bad"), payload: Number.NaN })).toEqual({
      accepted: false,
      reason: "unserializable-payload"
    });
    expect(store.append(null)).toEqual({
      accepted: false,
      reason: "invalid-event"
    });
    expect(store.list()).toEqual(before);
  });

  it("stores causal ancestry without keeping extra envelope fields", () => {
    const store = createMemoryEventStore();
    const admitted = admit(store, {
      ...event("root"),
      note: "not history"
    });
    expect(admitted).not.toHaveProperty("note");
    expect(admitted.provenance).toEqual([{ id: "prov-1", source: "fixture" }]);
    expect(admitted.semantics).toEqual([{ id: "rule-1", version: "1" }]);
    expect("nondeterminism" in admitted).toBe(false);
  });

  it("retains explicit nondeterminism inputs", () => {
    const store = createMemoryEventStore();
    const admitted = admit(store, {
      ...event("root"),
      nondeterminism: [{ id: "draw", value: { seed: 4 } }]
    });
    expect(admitted.nondeterminism).toEqual([
      { id: "draw", value: { seed: 4 } }
    ]);
  });

  it("protects stored history from later mutation", () => {
    const payload = { mark: "root" };
    const store = createMemoryEventStore();
    const admitted = admit(store, { ...event("root"), payload });
    payload.mark = "changed";

    expect(store.get("root")?.payload).toEqual({ mark: "root" });
    expect(Object.isFrozen(admitted)).toBe(true);
    expect(() => {
      (admitted as { type: string }).type = "rewritten";
    }).toThrow(TypeError);
    const listed = [...store.list()];
    listed.pop();
    expect(store.list()).toHaveLength(1);
  });

  it("keeps stores independent and serializable", () => {
    const first = createMemoryEventStore();
    const second = createMemoryEventStore();
    admit(first, event("root"));
    admit(second, event("root"));
    admit(first, event("child", ["root"]));

    expect(first.list().map(item => item.id)).toEqual(["root", "child"]);
    expect(second.list().map(item => item.id)).toEqual(["root"]);
    expect(JSON.parse(JSON.stringify(first.list()))).toEqual(first.list());
  });

  it("reproduces stored history from the same admitted inputs", () => {
    const inputs = [event("root"), event("child", ["root"])];
    const left = createMemoryEventStore();
    const right = createMemoryEventStore();
    for (const input of inputs) {
      left.append(input);
      right.append(input);
    }
    expect(left.list()).toEqual(right.list());
  });
});

function event(
  id: string,
  parents: readonly string[] = [],
  overrides: { readonly occurredAt?: string } = {}
): EventRecord {
  return {
    id,
    type: "established",
    payload: { mark: id },
    scope: { id: "scope-1" },
    occurredAt: overrides.occurredAt ?? "t0",
    parents,
    provenance: [{ id: "prov-1", source: "fixture" }],
    semantics: [{ id: "rule-1", version: "1" }]
  };
}

function admit(
  store: ReturnType<typeof createMemoryEventStore>,
  input: unknown
): EventRecord {
  const result = store.append(input);
  expect(result.accepted).toBe(true);
  if (!result.accepted) throw new Error(result.reason);
  return result.event;
}
