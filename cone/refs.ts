import { freezeDeep } from "./json";

export type ContinuityId = string;

export interface ContinuityRef {
  readonly id: ContinuityId;
  /** Descriptive label only. It does not establish identity. */
  readonly kind?: string;
}

export type ContinuityRejection = "empty-id" | "empty-kind";

export type ContinuityResult =
  | { readonly ok: true; readonly continuity: ContinuityRef }
  | { readonly ok: false; readonly reason: ContinuityRejection };

export function createContinuityRef(
  id: string,
  kind?: string
): ContinuityResult {
  if (id.length === 0) return { ok: false, reason: "empty-id" };
  if (kind !== undefined && kind.length === 0) {
    return { ok: false, reason: "empty-kind" };
  }
  const continuity: ContinuityRef = kind === undefined ? { id } : { id, kind };
  return { ok: true, continuity: freezeDeep(continuity) };
}

/** Identity is the continuity id. Kind and other structure do not count. */
export function sameContinuity(
  left: ContinuityRef,
  right: ContinuityRef
): boolean {
  return left.id.length > 0 && left.id === right.id;
}

export interface ScopeRef {
  readonly id: string;
}

export interface ProvenanceRef {
  readonly id: string;
  readonly source: string;
  readonly derivation?: string;
}

export interface VersionRef {
  readonly id: string;
  readonly version: string;
}

export interface Relationship {
  readonly id: string;
  readonly type: string;
  readonly refs: readonly string[];
  readonly scope: ScopeRef;
  readonly provenance: readonly ProvenanceRef[];
}

export type RelationshipRejection =
  | "empty-id"
  | "empty-type"
  | "missing-refs"
  | "invalid-ref"
  | "empty-scope"
  | "missing-provenance"
  | "invalid-provenance";

export type RelationshipResult =
  | { readonly ok: true; readonly relationship: Relationship }
  | { readonly ok: false; readonly reason: RelationshipRejection };

export function createRelationship(input: {
  readonly id: string;
  readonly type: string;
  readonly refs: readonly string[];
  readonly scope: ScopeRef;
  readonly provenance: readonly ProvenanceRef[];
}): RelationshipResult {
  if (input.id.length === 0) return { ok: false, reason: "empty-id" };
  if (input.type.length === 0) return { ok: false, reason: "empty-type" };
  if (input.refs.length === 0) return { ok: false, reason: "missing-refs" };
  if (input.refs.some(ref => ref.length === 0)) {
    return { ok: false, reason: "invalid-ref" };
  }
  const scope = readScope(input.scope);
  if (!scope.ok) return { ok: false, reason: "empty-scope" };
  const provenance = readProvenance(input.provenance);
  if (!provenance.ok) {
    return {
      ok: false,
      reason:
        provenance.reason === "missing"
          ? "missing-provenance"
          : "invalid-provenance"
    };
  }
  return {
    ok: true,
    relationship: freezeDeep({
      id: input.id,
      type: input.type,
      refs: [...input.refs],
      scope: scope.scope,
      provenance: provenance.provenance
    })
  };
}

export function readScope(
  value: unknown
): { readonly ok: true; readonly scope: ScopeRef } | { readonly ok: false } {
  if (typeof value !== "object" || value === null) return { ok: false };
  const id = readNonEmptyString(value, "id");
  if (id === undefined) return { ok: false };
  return { ok: true, scope: { id } };
}

export function readProvenance(
  value: unknown
):
  | { readonly ok: true; readonly provenance: readonly ProvenanceRef[] }
  | { readonly ok: false; readonly reason: "missing" | "invalid" } {
  if (value === undefined || (Array.isArray(value) && value.length === 0)) {
    return { ok: false, reason: "missing" };
  }
  if (!Array.isArray(value)) return { ok: false, reason: "invalid" };
  const provenance: ProvenanceRef[] = [];
  for (const entry of value) {
    const read = readProvenanceEntry(entry);
    if (read === undefined) return { ok: false, reason: "invalid" };
    provenance.push(read);
  }
  return { ok: true, provenance };
}

export function readVersions(
  value: unknown
):
  | { readonly ok: true; readonly semantics: readonly VersionRef[] }
  | { readonly ok: false; readonly reason: "missing" | "invalid" } {
  if (value === undefined || (Array.isArray(value) && value.length === 0)) {
    return { ok: false, reason: "missing" };
  }
  if (!Array.isArray(value)) return { ok: false, reason: "invalid" };
  const semantics: VersionRef[] = [];
  for (const entry of value) {
    const read = readVersionEntry(entry);
    if (read === undefined) return { ok: false, reason: "invalid" };
    semantics.push(read);
  }
  return { ok: true, semantics };
}

function readProvenanceEntry(value: unknown): ProvenanceRef | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const id = readNonEmptyString(value, "id");
  const source = readNonEmptyString(value, "source");
  if (id === undefined || source === undefined) return undefined;
  const derivation = readOptionalString(value, "derivation");
  if (!derivation.ok) return undefined;
  return derivation.value === undefined
    ? { id, source }
    : { id, source, derivation: derivation.value };
}

function readVersionEntry(value: unknown): VersionRef | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const id = readNonEmptyString(value, "id");
  const version = readNonEmptyString(value, "version");
  if (id === undefined || version === undefined) return undefined;
  return { id, version };
}

function readNonEmptyString(value: object, key: string): string | undefined {
  const raw: unknown = Reflect.get(value, key);
  if (typeof raw !== "string" || raw.length === 0) return undefined;
  return raw;
}

function readOptionalString(
  value: object,
  key: string
):
  | { readonly ok: true; readonly value: string | undefined }
  | { readonly ok: false } {
  if (!Object.hasOwn(value, key)) return { ok: true, value: undefined };
  const raw: unknown = Reflect.get(value, key);
  if (raw === undefined) return { ok: true, value: undefined };
  if (typeof raw !== "string" || raw.length === 0) return { ok: false };
  return { ok: true, value: raw };
}
