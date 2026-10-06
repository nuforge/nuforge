import { countMarkerRecord } from "./count-marker";
import type { ConstraintRecord } from "./constraint";
import { RESOLUTION_SEMANTICS } from "./dynamics";
import type { DeterministicInput, EventRecord, EventStore } from "./event";
import type { JsonValue } from "./json";
import { applyInteraction } from "./operations";
import type { Representation } from "./representation";
import type { ProvenanceRef } from "./refs";

export interface BulkProposal {
  readonly eventId: string;
  readonly bulkId: string;
  readonly count: number;
  readonly tallies: readonly {
    readonly marker: string;
    readonly exactly: number;
  }[];
  readonly scopeId: string;
  readonly occurredAt: string;
  readonly provenance: readonly ProvenanceRef[];
  readonly parents?: readonly string[];
}

export interface InteractionProposal {
  readonly eventId: string;
  readonly representation: Representation;
  readonly fromBulkId: string;
  readonly takeMarker: string;
  readonly addMark: string;
  readonly scopeId: string;
  readonly occurredAt: string;
  readonly provenance: readonly ProvenanceRef[];
  readonly parents: readonly string[];
  readonly continuityId?: string;
  readonly draw?: number;
}

export type ProposalResult =
  | { readonly ok: true; readonly event: EventRecord }
  | { readonly ok: false; readonly reason: string };

export function proposeBulk(input: BulkProposal): ProposalResult {
  if (
    input.bulkId.length === 0 ||
    !Number.isInteger(input.count) ||
    input.count < 0
  ) {
    return { ok: false, reason: "invalid-bulk" };
  }
  const seen = new Set<string>();
  const constraints: ConstraintRecord[] = [];
  for (const tally of input.tallies) {
    if (tally.marker.length === 0 || seen.has(tally.marker)) {
      return { ok: false, reason: "invalid-tally" };
    }
    if (
      !Number.isInteger(tally.exactly) ||
      tally.exactly < 0 ||
      tally.exactly > input.count
    ) {
      return { ok: false, reason: "invalid-tally" };
    }
    seen.add(tally.marker);
    constraints.push(
      countMarkerRecord(
        `${input.bulkId}:${tally.marker}`,
        tally.marker,
        tally.exactly
      )
    );
  }
  return {
    ok: true,
    event: buildEvent({
      id: input.eventId,
      type: "nuforge.bulk-established",
      payload: bulkPayload(input.bulkId, input.count, constraints),
      scopeId: input.scopeId,
      occurredAt: input.occurredAt,
      parents: input.parents ?? [],
      provenance: input.provenance
    })
  };
}

export function proposeInteraction(input: InteractionProposal): ProposalResult {
  const selected = selectedContinuity(input);
  if (!selected.ok) return selected;
  const applied = applyInteraction(input.representation, {
    fromBulkId: input.fromBulkId,
    continuityId: selected.continuityId,
    takeMarker: input.takeMarker,
    addMark: input.addMark
  });
  if (!applied.ok) return applied;
  return {
    ok: true,
    event: buildEvent({
      id: input.eventId,
      type: "nuforge.interaction-established",
      payload: {
        continuityId: selected.continuityId,
        fromBulkId: input.fromBulkId,
        takeMarker: input.takeMarker,
        addMark: input.addMark
      },
      scopeId: input.scopeId,
      occurredAt: input.occurredAt,
      parents: input.parents,
      provenance: input.provenance,
      ...(selected.nondeterminism === undefined
        ? {}
        : { nondeterminism: selected.nondeterminism })
    })
  };
}

export function establishProposal(
  store: EventStore,
  event: EventRecord,
  decision: "accept" | "reject"
):
  | { readonly accepted: true; readonly event: EventRecord }
  | { readonly accepted: false; readonly reason: string } {
  if (decision === "reject") return { accepted: false, reason: "rejected" };
  return store.append(event);
}

function selectedContinuity(input: InteractionProposal):
  | {
      readonly ok: true;
      readonly continuityId: string;
      readonly nondeterminism?: readonly DeterministicInput[];
    }
  | { readonly ok: false; readonly reason: string } {
  const hasId = input.continuityId !== undefined;
  const hasDraw = input.draw !== undefined;
  if (hasId === hasDraw) return { ok: false, reason: "ambiguous-selection" };
  if (input.draw !== undefined) {
    if (!Number.isInteger(input.draw) || input.draw < 0) {
      return { ok: false, reason: "invalid-draw" };
    }
    return {
      ok: true,
      continuityId: `selected:${input.draw}`,
      nondeterminism: [{ id: "selection", value: input.draw }]
    };
  }
  if (input.continuityId === undefined || input.continuityId.length === 0) {
    return { ok: false, reason: "ambiguous-selection" };
  }
  return { ok: true, continuityId: input.continuityId };
}

function bulkPayload(
  bulkId: string,
  count: number,
  constraints: readonly ConstraintRecord[]
): JsonValue {
  const records: JsonValue[] = constraints.map(constraint => ({
    id: constraint.id,
    kind: constraint.kind,
    version: constraint.version,
    parameters: constraint.parameters
  }));
  return { bulkId, count, constraints: records };
}

function buildEvent(input: {
  readonly id: string;
  readonly type: string;
  readonly payload: JsonValue;
  readonly scopeId: string;
  readonly occurredAt: string;
  readonly parents: readonly string[];
  readonly provenance: readonly ProvenanceRef[];
  readonly nondeterminism?: readonly DeterministicInput[];
}): EventRecord {
  const event: EventRecord = {
    id: input.id,
    type: input.type,
    payload: input.payload,
    scope: { id: input.scopeId },
    occurredAt: input.occurredAt,
    parents: input.parents,
    provenance: input.provenance,
    semantics: [RESOLUTION_SEMANTICS]
  };
  if (input.nondeterminism === undefined) return event;
  return { ...event, nondeterminism: input.nondeterminism };
}
