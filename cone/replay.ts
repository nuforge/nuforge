import { readCountMarker } from "./count-marker";
import type { ConstraintRecord } from "./constraint";
import { RESOLUTION_SEMANTICS } from "./dynamics";
import type { EventRecord } from "./event";
import { isJsonValue } from "./json";
import { applyInteraction, type OperationRejection } from "./operations";
import {
  emptyRepresentation,
  freezeRepresentation,
  type Bulk,
  type Representation
} from "./representation";

export type ReplayRejection =
  | OperationRejection
  | "unsupported-semantics"
  | "unknown-event"
  | "duplicate-event"
  | "unordered-parent"
  | "invalid-payload";

export type ReplayResult =
  | { readonly ok: true; readonly representation: Representation }
  | { readonly ok: false; readonly reason: ReplayRejection };

export type ContinuityStatus =
  | "active"
  | "ephemeral"
  | "recoverable"
  | "never-established";

export function replay(events: readonly EventRecord[]): ReplayResult {
  let current = emptyRepresentation();
  const seen = new Set<string>();
  for (const event of events) {
    if (seen.has(event.id)) return { ok: false, reason: "duplicate-event" };
    if (!usesResolution(event)) {
      return { ok: false, reason: "unsupported-semantics" };
    }
    for (const parent of event.parents) {
      if (!seen.has(parent)) return { ok: false, reason: "unordered-parent" };
    }
    const applied = apply(current, event);
    if (!applied.ok) return applied;
    current = applied.representation;
    seen.add(event.id);
  }
  return { ok: true, representation: freezeRepresentation(current) };
}

export function continuityStatus(
  working: Representation,
  events: readonly EventRecord[],
  continuityId: string
): ContinuityStatus {
  const visible = working.individuals.find(
    individual => individual.id === continuityId
  );
  if (visible?.established) return "active";
  if (visible && !visible.established) return "ephemeral";
  const folded = replay(events);
  if (
    folded.ok &&
    folded.representation.individuals.some(
      individual => individual.id === continuityId && individual.established
    )
  ) {
    return "recoverable";
  }
  return "never-established";
}

function apply(rep: Representation, event: EventRecord): ReplayResult {
  if (event.type === "nuforge.bulk-established")
    return applyBulk(rep, event.payload);
  if (event.type === "nuforge.interaction-established") {
    return applyInteractionEvent(rep, event.payload);
  }
  return { ok: false, reason: "unknown-event" };
}

function applyBulk(rep: Representation, payload: unknown): ReplayResult {
  const read = readBulkPayload(payload);
  if (read === undefined) return { ok: false, reason: "invalid-payload" };
  if (rep.bulks.some(bulk => bulk.id === read.id)) {
    return { ok: false, reason: "duplicate-bulk" };
  }
  if (rep.individuals.some(individual => individual.id === read.id)) {
    return { ok: false, reason: "duplicate-continuity" };
  }
  const bulk: Bulk = read;
  const representation: Representation = {
    individuals: rep.individuals,
    bulks: [...rep.bulks, bulk]
  };
  return { ok: true, representation };
}

function applyInteractionEvent(
  rep: Representation,
  payload: unknown
): ReplayResult {
  if (!isRecord(payload)) return { ok: false, reason: "invalid-payload" };
  const continuityId = readString(payload, "continuityId");
  const fromBulkId = readString(payload, "fromBulkId");
  const takeMarker = readString(payload, "takeMarker");
  const addMark = readString(payload, "addMark");
  if (
    continuityId === undefined ||
    fromBulkId === undefined ||
    takeMarker === undefined ||
    addMark === undefined
  ) {
    return { ok: false, reason: "invalid-payload" };
  }
  return applyInteraction(rep, {
    continuityId,
    fromBulkId,
    takeMarker,
    addMark
  });
}

function readBulkPayload(payload: unknown): Bulk | undefined {
  if (!isRecord(payload)) return undefined;
  const id = readString(payload, "bulkId");
  const count = payload.count;
  const constraints = payload.constraints;
  if (
    id === undefined ||
    typeof count !== "number" ||
    !Number.isInteger(count)
  ) {
    return undefined;
  }
  if (count < 0 || !Array.isArray(constraints)) return undefined;
  const records: ConstraintRecord[] = [];
  for (const constraint of constraints) {
    if (!isConstraintRecord(constraint)) return undefined;
    const tally = readCountMarker(constraint);
    if (
      tally === undefined ||
      tally === "unreadable" ||
      tally.exactly > count
    ) {
      return undefined;
    }
    records.push(constraint);
  }
  return { id, count, constraints: records };
}

function isConstraintRecord(value: unknown): value is ConstraintRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.kind === "string" &&
    typeof value.version === "string" &&
    isJsonValue(value.parameters)
  );
}

function usesResolution(event: EventRecord): boolean {
  return event.semantics.some(
    version =>
      version.id === RESOLUTION_SEMANTICS.id &&
      version.version === RESOLUTION_SEMANTICS.version
  );
}

function readString(
  value: Record<string, unknown>,
  key: string
): string | undefined {
  const raw = value[key];
  if (typeof raw !== "string" || raw.length === 0) return undefined;
  return raw;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
