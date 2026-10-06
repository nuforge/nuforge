import {
  cloneJsonValue,
  freezeDeep,
  isJsonValue,
  type JsonValue
} from "./json";
import {
  readProvenance,
  readScope,
  readVersions,
  type ProvenanceRef,
  type ScopeRef,
  type VersionRef
} from "./refs";

export interface DeterministicInput {
  readonly id: string;
  readonly value: JsonValue;
}

export interface EventRecord<TPayload extends JsonValue = JsonValue> {
  readonly id: string;
  readonly type: string;
  readonly payload: TPayload;
  readonly scope: ScopeRef;
  readonly occurredAt: string;
  readonly parents: readonly string[];
  readonly provenance: readonly ProvenanceRef[];
  readonly semantics: readonly VersionRef[];
  readonly nondeterminism?: readonly DeterministicInput[];
}

export interface EventStore {
  /** Admit a record. Rejection leaves stored history unchanged. */
  append(event: unknown): AppendResult;
  get(id: string): EventRecord | undefined;
  /**
   * Insertion order. This is storage order, not a causal total order.
   * Causal ancestry is `parents`.
   */
  list(): readonly EventRecord[];
}

export type AppendResult =
  | { readonly accepted: true; readonly event: EventRecord }
  | { readonly accepted: false; readonly reason: AppendRejection };

export type AppendRejection =
  | "invalid-event"
  | "empty-id"
  | "duplicate-id"
  | "empty-type"
  | "empty-occurred-at"
  | "unserializable-payload"
  | "empty-scope"
  | "invalid-parents"
  | "self-parent"
  | "duplicate-parent"
  | "unknown-parent"
  | "missing-provenance"
  | "invalid-provenance"
  | "missing-semantics"
  | "invalid-semantics"
  | "invalid-nondeterminism";

export function createMemoryEventStore(): EventStore {
  const events: EventRecord[] = [];
  const byId = new Map<string, EventRecord>();

  return {
    append(input) {
      const admitted = admitEvent(input, byId);
      if (!admitted.accepted) return admitted;
      events.push(admitted.event);
      byId.set(admitted.event.id, admitted.event);
      return admitted;
    },
    get(id) {
      return byId.get(id);
    },
    list() {
      return events.slice();
    }
  };
}

function admitEvent(
  input: unknown,
  known: ReadonlyMap<string, EventRecord>
): AppendResult {
  if (typeof input !== "object" || input === null) {
    return { accepted: false, reason: "invalid-event" };
  }
  const id = readRequiredString(input, "id");
  if (id === undefined) return { accepted: false, reason: "empty-id" };
  if (known.has(id)) return { accepted: false, reason: "duplicate-id" };
  const type = readRequiredString(input, "type");
  if (type === undefined) return { accepted: false, reason: "empty-type" };
  const occurredAt = readRequiredString(input, "occurredAt");
  if (occurredAt === undefined) {
    return { accepted: false, reason: "empty-occurred-at" };
  }
  const payload: unknown = Reflect.get(input, "payload");
  if (!isJsonValue(payload)) {
    return { accepted: false, reason: "unserializable-payload" };
  }
  const scope = readScope(Reflect.get(input, "scope"));
  if (!scope.ok) return { accepted: false, reason: "empty-scope" };
  const parents = readParents(Reflect.get(input, "parents"), id, known);
  if (!parents.ok) return { accepted: false, reason: parents.reason };
  const provenance = readProvenance(Reflect.get(input, "provenance"));
  if (!provenance.ok) {
    return {
      accepted: false,
      reason:
        provenance.reason === "missing"
          ? "missing-provenance"
          : "invalid-provenance"
    };
  }
  const semantics = readVersions(Reflect.get(input, "semantics"));
  if (!semantics.ok) {
    return {
      accepted: false,
      reason:
        semantics.reason === "missing"
          ? "missing-semantics"
          : "invalid-semantics"
    };
  }
  const nondeterminism = readNondeterminism(
    input,
    Reflect.get(input, "nondeterminism")
  );
  if (!nondeterminism.ok) {
    return { accepted: false, reason: "invalid-nondeterminism" };
  }

  const event: EventRecord = {
    id,
    type,
    payload: cloneJsonValue(payload),
    scope: scope.scope,
    occurredAt,
    parents: parents.parents,
    provenance: provenance.provenance,
    semantics: semantics.semantics
  };
  const stored =
    nondeterminism.inputs === undefined
      ? event
      : { ...event, nondeterminism: nondeterminism.inputs };
  return { accepted: true, event: freezeDeep(stored) };
}

function readParents(
  value: unknown,
  selfId: string,
  known: ReadonlyMap<string, EventRecord>
):
  | { readonly ok: true; readonly parents: readonly string[] }
  | { readonly ok: false; readonly reason: AppendRejection } {
  if (!Array.isArray(value)) return { ok: false, reason: "invalid-parents" };
  const parents: string[] = [];
  const seen = new Set<string>();
  for (const parent of value) {
    if (typeof parent !== "string" || parent.length === 0) {
      return { ok: false, reason: "invalid-parents" };
    }
    if (parent === selfId) return { ok: false, reason: "self-parent" };
    if (seen.has(parent)) return { ok: false, reason: "duplicate-parent" };
    if (!known.has(parent)) return { ok: false, reason: "unknown-parent" };
    seen.add(parent);
    parents.push(parent);
  }
  return { ok: true, parents };
}

function readNondeterminism(
  event: object,
  value: unknown
):
  | {
      readonly ok: true;
      readonly inputs: readonly DeterministicInput[] | undefined;
    }
  | { readonly ok: false } {
  if (!Object.hasOwn(event, "nondeterminism") || value === undefined) {
    return { ok: true, inputs: undefined };
  }
  if (!Array.isArray(value)) return { ok: false };
  const inputs: DeterministicInput[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return { ok: false };
    const id = readRequiredString(entry, "id");
    const inputValue: unknown = Reflect.get(entry, "value");
    if (id === undefined || !isJsonValue(inputValue)) return { ok: false };
    inputs.push({ id, value: cloneJsonValue(inputValue) });
  }
  return { ok: true, inputs };
}

function readRequiredString(value: object, key: string): string | undefined {
  const raw: unknown = Reflect.get(value, key);
  if (typeof raw !== "string" || raw.length === 0) return undefined;
  return raw;
}
