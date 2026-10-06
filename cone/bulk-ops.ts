import {
  copyConstraint,
  countMarkerRecord,
  readCountMarker
} from "./count-marker";
import type { ConstraintRecord } from "./constraint";
import {
  accept,
  bulkFits,
  constraintId,
  findBulk,
  fits,
  reject,
  replaceBulk,
  type OperationResult
} from "./operation-shared";
import {
  markerConstraint,
  type Bulk,
  type Representation
} from "./representation";

export function constrain(
  rep: Representation,
  input: {
    readonly bulkId: string;
    readonly marker: string;
    readonly exactly: number;
  }
): OperationResult {
  const bulk = findBulk(rep, input.bulkId);
  if (bulk === undefined) return reject("missing-bulk");
  if (!fits(input.exactly, bulk.count) || input.marker.length === 0) {
    return reject("invalid-tally");
  }
  const current = markerConstraint(bulk, input.marker);
  if (current === "ambiguous" || current === "unreadable") {
    return reject("invalid-tally");
  }
  if (current !== "missing") {
    if (current.exactly !== input.exactly) return reject("tally-conflict");
    return { ok: true, representation: rep };
  }
  return accept(
    replaceBulk(rep, {
      ...bulk,
      constraints: [
        ...bulk.constraints.map(constraint => copyConstraint(constraint)),
        countMarkerRecord(
          constraintId(bulk.id, input.marker),
          input.marker,
          input.exactly
        )
      ]
    })
  );
}

export function mergeBulks(
  rep: Representation,
  input: {
    readonly leftId: string;
    readonly rightId: string;
    readonly intoId: string;
  }
): OperationResult {
  if (input.leftId === input.rightId || input.intoId.length === 0) {
    return reject("missing-bulk");
  }
  const left = findBulk(rep, input.leftId);
  const right = findBulk(rep, input.rightId);
  if (left === undefined || right === undefined) return reject("missing-bulk");
  const collides = rep.bulks.some(
    bulk =>
      bulk.id === input.intoId &&
      bulk.id !== input.leftId &&
      bulk.id !== input.rightId
  );
  if (collides) return reject("duplicate-bulk");
  if (rep.individuals.some(individual => individual.id === input.intoId)) {
    return reject("duplicate-continuity");
  }
  const constraints = mergeConstraints(left, right, input.intoId);
  if (constraints === undefined) return reject("tally-conflict");
  const merged: Bulk = {
    id: input.intoId,
    count: left.count + right.count,
    constraints
  };
  if (!bulkFits(merged)) return reject("invalid-tally");
  const bulks = [
    ...rep.bulks.filter(
      bulk => bulk.id !== input.leftId && bulk.id !== input.rightId
    ),
    merged
  ];
  return accept({ individuals: rep.individuals, bulks });
}

function mergeConstraints(
  left: Bulk,
  right: Bulk,
  intoId: string
): readonly ConstraintRecord[] | undefined {
  const names = new Set<string>();
  for (const bulk of [left, right]) {
    for (const constraint of bulk.constraints) {
      const read = readCountMarker(constraint);
      if (read === "unreadable") return undefined;
      if (read !== undefined) names.add(read.marker);
    }
  }
  const merged: ConstraintRecord[] = [];
  for (const marker of [...names].sort()) {
    const leftCount = markerConstraint(left, marker);
    const rightCount = markerConstraint(right, marker);
    if (
      leftCount === "ambiguous" ||
      leftCount === "unreadable" ||
      rightCount === "ambiguous" ||
      rightCount === "unreadable"
    ) {
      return undefined;
    }
    const exactly =
      (leftCount === "missing" ? 0 : leftCount.exactly) +
      (rightCount === "missing" ? 0 : rightCount.exactly);
    merged.push(
      countMarkerRecord(constraintId(intoId, marker), marker, exactly)
    );
  }
  return merged;
}
