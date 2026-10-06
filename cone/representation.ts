import {
  copyConstraint,
  readCountMarker,
  type CountMarker
} from "./count-marker";
import type { ConstraintRecord } from "./constraint";
import { freezeDeep } from "./json";

export interface Individual {
  readonly id: string;
  readonly marks: readonly string[];
  readonly established: boolean;
  readonly originBulkId?: string;
}

export interface Bulk {
  readonly id: string;
  readonly count: number;
  readonly constraints: readonly ConstraintRecord[];
}

/** Working or established variable-resolution state. Not a history record. */
export interface Representation {
  readonly individuals: readonly Individual[];
  readonly bulks: readonly Bulk[];
}

export interface CountSnapshot {
  readonly count: number;
  readonly markers: readonly CountMarker[];
}

export function emptyRepresentation(): Representation {
  return freezeDeep({ individuals: [], bulks: [] });
}

export function representedMarkerCount(
  rep: Representation,
  marker: string
): number | undefined {
  if (!markerNames(rep).includes(marker)) return undefined;
  return markerTotal(rep, marker);
}

export function totalCount(rep: Representation): number {
  const bulkCount = rep.bulks.reduce((sum, bulk) => sum + bulk.count, 0);
  return bulkCount + rep.individuals.length;
}

export function countSnapshot(rep: Representation): CountSnapshot | undefined {
  const names = markerNames(rep);
  const markers: CountMarker[] = [];
  for (const marker of names) {
    const count = markerTotal(rep, marker);
    if (count === undefined) return undefined;
    markers.push({ marker, exactly: count });
  }
  return { count: totalCount(rep), markers };
}

export function sameCounts(
  left: Representation,
  right: Representation
): boolean {
  const a = countSnapshot(left);
  const b = countSnapshot(right);
  if (a === undefined || b === undefined) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function sameIdentities(
  left: Representation,
  right: Representation
): boolean {
  return (
    JSON.stringify(establishedIdentities(left)) ===
    JSON.stringify(establishedIdentities(right))
  );
}

export function markerConstraint(
  bulk: Bulk,
  marker: string
): CountMarker | "missing" | "ambiguous" | "unreadable" {
  let found: CountMarker | undefined;
  for (const constraint of bulk.constraints) {
    const read = readCountMarker(constraint);
    if (read === undefined) continue;
    if (read === "unreadable") return "unreadable";
    if (read.marker !== marker) continue;
    if (found !== undefined) return "ambiguous";
    found = read;
  }
  return found ?? "missing";
}

export function freezeRepresentation(rep: Representation): Representation {
  return freezeDeep({
    individuals: rep.individuals.map(individual => ({
      id: individual.id,
      marks: [...individual.marks],
      established: individual.established,
      ...(individual.originBulkId === undefined
        ? {}
        : { originBulkId: individual.originBulkId })
    })),
    bulks: rep.bulks.map(bulk => ({
      id: bulk.id,
      count: bulk.count,
      constraints: bulk.constraints.map(constraint =>
        copyConstraint(constraint)
      )
    }))
  });
}

function establishedIdentities(
  rep: Representation
): readonly { readonly id: string; readonly marks: readonly string[] }[] {
  return rep.individuals
    .filter(individual => individual.established)
    .map(individual => ({ id: individual.id, marks: individual.marks }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function markerNames(rep: Representation): string[] {
  const names = new Set<string>();
  for (const individual of rep.individuals) {
    for (const mark of individual.marks) names.add(mark);
  }
  for (const bulk of rep.bulks) {
    for (const constraint of bulk.constraints) {
      const read = readCountMarker(constraint);
      if (read !== undefined && read !== "unreadable") names.add(read.marker);
    }
  }
  return [...names].sort();
}

function markerTotal(rep: Representation, marker: string): number | undefined {
  let total = 0;
  for (const individual of rep.individuals) {
    if (individual.marks.includes(marker)) total += 1;
  }
  for (const bulk of rep.bulks) {
    const read = markerConstraint(bulk, marker);
    if (read === "ambiguous" || read === "unreadable") return undefined;
    if (read === "missing") continue;
    total += read.exactly;
  }
  return total;
}
