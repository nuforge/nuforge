import {
  cloneJsonValue,
  freezeDeep,
  isJsonValue,
  type JsonValue
} from "./json";

/**
 * Serializable constraint data. Behavior lives in a versioned evaluator
 * registered beside history, not on the stored record.
 */
export interface ConstraintRecord {
  readonly id: string;
  readonly kind: string;
  readonly version: string;
  readonly parameters: JsonValue;
}

export interface ConstraintDescriptor {
  readonly id: string;
  readonly kind: string;
  readonly version: string;
  readonly summary: string;
}

export type ConstraintResult =
  | { readonly status: "satisfied" }
  | { readonly status: "violated"; readonly reason: string }
  | {
      readonly status: "inapplicable";
      readonly reason: "no-evaluator" | "invalid-record" | "invalid-state";
    };

export interface ConstraintEvaluator {
  readonly kind: string;
  readonly version: string;
  inspect(record: ConstraintRecord): ConstraintDescriptor;
  evaluate(record: ConstraintRecord, state: JsonValue): ConstraintResult;
}

export type RegisterResult =
  | { readonly registered: true }
  | {
      readonly registered: false;
      readonly reason: "empty-kind" | "empty-version" | "duplicate-version";
    };

export type InspectResult =
  | { readonly ok: true; readonly descriptor: ConstraintDescriptor }
  | { readonly ok: false; readonly reason: "no-evaluator" | "invalid-record" };

export interface ConstraintRegistry {
  register(evaluator: ConstraintEvaluator): RegisterResult;
  inspect(record: ConstraintRecord): InspectResult;
  evaluate(record: ConstraintRecord, state: unknown): ConstraintResult;
}

export function createConstraintRegistry(): ConstraintRegistry {
  const evaluators = new Map<string, ConstraintEvaluator>();

  return {
    register(evaluator) {
      if (evaluator.kind.length === 0) {
        return { registered: false, reason: "empty-kind" };
      }
      if (evaluator.version.length === 0) {
        return { registered: false, reason: "empty-version" };
      }
      const key = registryKey(evaluator.kind, evaluator.version);
      if (evaluators.has(key)) {
        return { registered: false, reason: "duplicate-version" };
      }
      evaluators.set(key, evaluator);
      return { registered: true };
    },
    inspect(record) {
      const valid = readConstraint(record);
      if (!valid) return { ok: false, reason: "invalid-record" };
      const evaluator = evaluators.get(registryKey(valid.kind, valid.version));
      if (evaluator === undefined) return { ok: false, reason: "no-evaluator" };
      const produced = evaluator.inspect(valid);
      if (produced.summary.length === 0) {
        return { ok: false, reason: "invalid-record" };
      }
      return {
        ok: true,
        descriptor: freezeDeep({
          id: valid.id,
          kind: valid.kind,
          version: valid.version,
          summary: produced.summary
        })
      };
    },
    evaluate(record, state) {
      const valid = readConstraint(record);
      if (!valid) return { status: "inapplicable", reason: "invalid-record" };
      if (!isJsonValue(state)) {
        return { status: "inapplicable", reason: "invalid-state" };
      }
      const evaluator = evaluators.get(registryKey(valid.kind, valid.version));
      if (evaluator === undefined) {
        return { status: "inapplicable", reason: "no-evaluator" };
      }
      return evaluator.evaluate(valid, freezeDeep(cloneJsonValue(state)));
    }
  };
}

function readConstraint(
  record: ConstraintRecord
): ConstraintRecord | undefined {
  if (record.id.length === 0 || record.kind.length === 0) return undefined;
  if (record.version.length === 0 || !isJsonValue(record.parameters)) {
    return undefined;
  }
  return freezeDeep({
    id: record.id,
    kind: record.kind,
    version: record.version,
    parameters: cloneJsonValue(record.parameters)
  });
}

function registryKey(kind: string, version: string): string {
  return `${kind}\u0000${version}`;
}
