import { describe, expect, it } from "vitest";
import {
  createConstraintRegistry,
  createMemoryEventStore,
  type ConstraintEvaluator,
  type ConstraintRecord
} from "../index";

describe("constraint protocol", () => {
  it("inspects and evaluates through a registered version", () => {
    const registry = createConstraintRegistry();
    expect(registry.register(equalityEvaluator())).toEqual({
      registered: true
    });
    const record = constraint(1);

    expect(registry.inspect(record)).toEqual({
      ok: true,
      descriptor: {
        id: record.id,
        kind: record.kind,
        version: record.version,
        summary: "state equals parameters"
      }
    });
    expect(registry.evaluate(record, 1)).toEqual({ status: "satisfied" });
    expect(registry.evaluate(record, 2)).toEqual({
      status: "violated",
      reason: "not-equal"
    });
  });

  it("does not replace a registered version or invent a result", () => {
    const registry = createConstraintRegistry();
    registry.register(equalityEvaluator());
    expect(registry.register(equalityEvaluator())).toEqual({
      registered: false,
      reason: "duplicate-version"
    });
    expect(registry.evaluate(constraint(1), 1)).toEqual({
      status: "satisfied"
    });
    expect(
      registry.evaluate(
        { id: "other", kind: "membership", version: "1", parameters: null },
        1
      )
    ).toEqual({ status: "inapplicable", reason: "no-evaluator" });
    expect(registry.evaluate(constraint(1), Number.NaN)).toEqual({
      status: "inapplicable",
      reason: "invalid-state"
    });
    expect(registry.inspect({ ...constraint(1), id: "" })).toEqual({
      ok: false,
      reason: "invalid-record"
    });
  });

  it("does not admit history and does not mutate the caller state", () => {
    const registry = createConstraintRegistry();
    const store = createMemoryEventStore();
    const state = { expected: 1 };
    registry.register({
      kind: "equality",
      version: "1",
      inspect() {
        return {
          id: "constraint-1",
          kind: "equality",
          version: "1",
          summary: "snapshot"
        };
      },
      evaluate(_record, received) {
        expect(received).not.toBe(state);
        expect(Object.isFrozen(received)).toBe(true);
        return { status: "satisfied" };
      }
    });

    expect(registry.evaluate(constraint(state), state).status).toBe(
      "satisfied"
    );
    expect(state).toEqual({ expected: 1 });
    expect(store.list()).toEqual([]);
  });
});

function constraint(
  parameters: ConstraintRecord["parameters"]
): ConstraintRecord {
  return {
    id: "constraint-1",
    kind: "equality",
    version: "1",
    parameters
  };
}

function equalityEvaluator(): ConstraintEvaluator {
  return {
    kind: "equality",
    version: "1",
    inspect() {
      return {
        id: "lie",
        kind: "lie",
        version: "lie",
        summary: "state equals parameters"
      };
    },
    evaluate(record, state) {
      const same = JSON.stringify(state) === JSON.stringify(record.parameters);
      return same
        ? { status: "satisfied" }
        : { status: "violated", reason: "not-equal" };
    }
  };
}
