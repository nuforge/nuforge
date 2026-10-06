import {
  copyConstraint,
  countMarkerRecord,
  readCountMarker
} from "./count-marker";
import type { ConstraintRecord } from "./constraint";
import {
  freezeRepresentation,
  type Bulk,
  type Representation
} from "./representation";

export type OperationRejection =
  | "missing-bulk"
  | "duplicate-bulk"
  | "empty-count"
  | "marker-unavailable"
  | "duplicate-continuity"
  | "missing-continuity"
  | "missing-mark"
  | "invalid-tally"
  | "tally-conflict"
  | "protected-mark"
  | "unresolved-origin";

export type OperationResult =
  | { readonly ok: true; readonly representation: Representation }
  | { readonly ok: false; readonly reason: OperationRejection };

export function accept(rep: Representation): OperationResult {
  return { ok: true, representation: freezeRepresentation(rep) };
}

export function reject(reason: OperationRejection): OperationResult {
  return { ok: false, reason };
}

export function findBulk(rep: Representation, id: string): Bulk | undefined {
  return rep.bulks.find(bulk => bulk.id === id);
}

export function replaceBulk(rep: Representation, bulk: Bulk): Representation {
  return {
    individuals: rep.individuals,
    bulks: rep.bulks.map(item => (item.id === bulk.id ? bulk : cloneBulk(item)))
  };
}

export function cloneBulk(bulk: Bulk): Bulk {
  return {
    id: bulk.id,
    count: bulk.count,
    constraints: bulk.constraints.map(constraint => copyConstraint(constraint))
  };
}

export function identityTaken(rep: Representation, id: string): boolean {
  return (
    rep.individuals.some(individual => individual.id === id) ||
    rep.bulks.some(bulk => bulk.id === id)
  );
}

export function bulkFits(bulk: Bulk): boolean {
  return bulk.constraints.every(constraint => {
    const read = readCountMarker(constraint);
    if (read === undefined) return true;
    if (read === "unreadable") return false;
    return fits(read.exactly, bulk.count);
  });
}

export function fits(exactly: number, count: number): boolean {
  return Number.isInteger(exactly) && exactly >= 0 && exactly <= count;
}

export function constraintId(bulkId: string, marker: string): string {
  return `${bulkId}:${marker}`;
}

export function uniqueSorted(marks: readonly string[]): string[] {
  return [...new Set(marks)].sort();
}

export function adjustExactly(
  constraints: readonly ConstraintRecord[],
  marker: string,
  delta: number
): readonly ConstraintRecord[] | undefined {
  let seen = false;
  let changed = false;
  const next: ConstraintRecord[] = [];
  for (const constraint of constraints) {
    const read = readCountMarker(constraint);
    if (read === "unreadable") return undefined;
    if (read === undefined || read.marker !== marker) {
      next.push(constraint);
      continue;
    }
    if (seen) return undefined;
    seen = true;
    const exactly = read.exactly + delta;
    if (exactly < 0) return undefined;
    changed = true;
    next.push(countMarkerRecord(constraint.id, marker, exactly));
  }
  if (!seen || !changed) return undefined;
  return next;
}
