import type { JsonValue } from "./json";
import { refine, type OperationRejection } from "./operations";
import { representedMarkerCount, type Representation } from "./representation";
import type { ProvenanceRef, VersionRef } from "./refs";

export const RESOLUTION_SEMANTICS: VersionRef = {
  id: "nuforge.resolution",
  version: "1"
};

export interface ValidityEnvelope {
  readonly conditions: readonly string[];
}

export interface Requirement {
  readonly id: string;
  readonly description: string;
}

export type Sufficiency =
  | { readonly kind: "sufficient" }
  | { readonly kind: "insufficient"; readonly missing: readonly Requirement[] };

export interface EvaluatedValue<T extends JsonValue> {
  readonly value: T;
  readonly provenance: readonly ProvenanceRef[];
  readonly validity?: ValidityEnvelope;
}

export type Evaluation<T extends JsonValue> =
  | { readonly kind: "sufficient"; readonly value: EvaluatedValue<T> }
  | {
      readonly kind: "insufficient";
      readonly missing: readonly Requirement[];
    };

export interface MaterializeQuery {
  readonly queryId: string;
  readonly bulkId: string;
  readonly marker: string;
  readonly continuityId: string;
  readonly provenance: readonly ProvenanceRef[];
}

export type QueryResult =
  | {
      readonly ok: true;
      readonly evaluation: Evaluation<string>;
      readonly working: Representation;
    }
  | { readonly ok: false; readonly reason: OperationRejection };

export function countMarker(
  rep: Representation,
  marker: string,
  provenance: readonly ProvenanceRef[]
): Evaluation<number> {
  const count = representedMarkerCount(rep, marker);
  if (count === undefined) {
    return {
      kind: "insufficient",
      missing: [
        {
          id: marker,
          description: "marker is not represented"
        }
      ]
    };
  }
  return {
    kind: "sufficient",
    value: {
      value: count,
      provenance,
      validity: { conditions: ["exact-marker-counts"] }
    }
  };
}

export function evaluateIdentity(
  rep: Representation,
  continuityId: string,
  provenance: readonly ProvenanceRef[]
): Evaluation<JsonValue> {
  const found = rep.individuals.find(
    individual => individual.id === continuityId
  );
  const value: JsonValue = {
    present: found !== undefined,
    established: found?.established === true
  };
  return {
    kind: "sufficient",
    value: {
      value,
      provenance,
      validity: { conditions: ["identity-presence"] }
    }
  };
}

/** Query-local refinement. The working copy is not history. */
export function evaluateOneMarked(
  rep: Representation,
  query: MaterializeQuery
): QueryResult {
  const refined = refine(rep, {
    bulkId: query.bulkId,
    marker: query.marker,
    continuityId: query.continuityId
  });
  if (!refined.ok) {
    if (
      refined.reason === "marker-unavailable" ||
      refined.reason === "empty-count"
    ) {
      return {
        ok: true,
        working: rep,
        evaluation: {
          kind: "insufficient",
          missing: [
            {
              id: query.queryId,
              description: "one compatible unit"
            }
          ]
        }
      };
    }
    return refined;
  }
  return {
    ok: true,
    working: refined.representation,
    evaluation: {
      kind: "sufficient",
      value: {
        value: query.continuityId,
        provenance: query.provenance,
        validity: { conditions: ["ephemeral-refinement"] }
      }
    }
  };
}
