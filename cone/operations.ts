import { copyConstraint } from "./count-marker";
import type { ConstraintRecord } from "./constraint";
import {
  accept,
  adjustExactly,
  bulkFits,
  cloneBulk,
  findBulk,
  identityTaken,
  reject,
  uniqueSorted,
  type OperationResult
} from "./operation-shared";
import type { Bulk, Individual, Representation } from "./representation";

export { constrain, mergeBulks } from "./bulk-ops";
export type { OperationRejection, OperationResult } from "./operation-shared";

export function split(
  rep: Representation,
  input: {
    readonly bulkId: string;
    readonly continuityId: string;
    readonly marks: readonly string[];
  }
): OperationResult {
  return splitUnit(rep, { ...input, established: false });
}

export function refine(
  rep: Representation,
  input: {
    readonly bulkId: string;
    readonly marker: string;
    readonly continuityId: string;
  }
): OperationResult {
  return splitUnit(rep, {
    bulkId: input.bulkId,
    continuityId: input.continuityId,
    marks: [input.marker],
    established: false
  });
}

export function coarsen(rep: Representation): OperationResult {
  const established = rep.individuals.filter(
    individual => individual.established
  );
  const ephemerals = rep.individuals.filter(
    individual => !individual.established
  );
  let bulks: readonly Bulk[] = rep.bulks.map(cloneBulk);
  for (const individual of ephemerals) {
    const restored = restore(bulks, individual);
    if (restored === undefined) {
      const origin = individual.originBulkId;
      if (
        origin === undefined ||
        findBulk({ individuals: [], bulks }, origin) === undefined
      ) {
        return reject("unresolved-origin");
      }
      return reject("protected-mark");
    }
    bulks = restored;
  }
  return accept({ individuals: established, bulks });
}

export function applyInteraction(
  rep: Representation,
  input: {
    readonly fromBulkId: string;
    readonly continuityId: string;
    readonly takeMarker: string;
    readonly addMark: string;
  }
): OperationResult {
  const extracted = splitUnit(rep, {
    bulkId: input.fromBulkId,
    continuityId: input.continuityId,
    marks: [input.takeMarker],
    established: true
  });
  if (!extracted.ok) return extracted;
  return addMark(extracted.representation, input.continuityId, input.addMark);
}

function splitUnit(
  rep: Representation,
  input: {
    readonly bulkId: string;
    readonly continuityId: string;
    readonly marks: readonly string[];
    readonly established: boolean;
  }
): OperationResult {
  if (input.continuityId.length === 0) return reject("duplicate-continuity");
  if (identityTaken(rep, input.continuityId)) {
    return reject("duplicate-continuity");
  }
  const bulk = findBulk(rep, input.bulkId);
  if (bulk === undefined) return reject("missing-bulk");
  if (bulk.count < 1) return reject("empty-count");
  const marks = uniqueSorted(input.marks);
  if (marks.length === 0 || marks.some(mark => mark.length === 0)) {
    return reject("missing-mark");
  }
  let constraints: readonly ConstraintRecord[] = bulk.constraints.map(
    constraint => copyConstraint(constraint)
  );
  for (const mark of marks) {
    const adjusted = adjustExactly(constraints, mark, -1);
    if (adjusted === undefined) return reject("marker-unavailable");
    constraints = adjusted;
  }
  const nextBulk: Bulk = { id: bulk.id, count: bulk.count - 1, constraints };
  if (!bulkFits(nextBulk)) return reject("invalid-tally");
  const individual: Individual = {
    id: input.continuityId,
    marks,
    established: input.established,
    originBulkId: bulk.id
  };
  return accept({
    individuals: [...rep.individuals, individual],
    bulks: rep.bulks.map(item =>
      item.id === bulk.id ? nextBulk : cloneBulk(item)
    )
  });
}

function addMark(
  rep: Representation,
  continuityId: string,
  mark: string
): OperationResult {
  if (mark.length === 0) return reject("missing-mark");
  let found = false;
  const individuals = rep.individuals.map(individual => {
    if (individual.id !== continuityId) return individual;
    found = true;
    if (individual.marks.includes(mark)) return individual;
    return { ...individual, marks: uniqueSorted([...individual.marks, mark]) };
  });
  if (!found) return reject("missing-continuity");
  return accept({ individuals, bulks: rep.bulks });
}

function restore(
  bulks: readonly Bulk[],
  individual: Individual
): readonly Bulk[] | undefined {
  const origin = individual.originBulkId;
  if (origin === undefined) return undefined;
  let found = false;
  const next = bulks.map(bulk => {
    if (bulk.id !== origin) return bulk;
    found = true;
    let constraints = bulk.constraints;
    for (const mark of individual.marks) {
      const adjusted = adjustExactly(constraints, mark, 1);
      if (adjusted === undefined) return bulk;
      constraints = adjusted;
    }
    if (constraints === bulk.constraints) return bulk;
    const restored: Bulk = {
      id: bulk.id,
      count: bulk.count + 1,
      constraints
    };
    return bulkFits(restored) ? restored : bulk;
  });
  if (!found) return undefined;
  const updated = next.find(bulk => bulk.id === origin);
  const previous = bulks.find(bulk => bulk.id === origin);
  if (updated === undefined || previous === undefined) return undefined;
  if (updated.count !== previous.count + 1) return undefined;
  return next;
}
