/**
 * Public NuForge boundary. Depend on this module, not on internal files.
 * The framework stays domain-neutral and headless.
 */
export { isJsonValue, type JsonValue } from "./json";
export {
  createContinuityRef,
  createRelationship,
  sameContinuity,
  type ContinuityId,
  type ContinuityRef,
  type ContinuityRejection,
  type ContinuityResult,
  type ProvenanceRef,
  type Relationship,
  type RelationshipRejection,
  type RelationshipResult,
  type ScopeRef,
  type VersionRef
} from "./refs";
export {
  createMemoryEventStore,
  type AppendRejection,
  type AppendResult,
  type DeterministicInput,
  type EventRecord,
  type EventStore
} from "./event";
export {
  createConstraintRegistry,
  type ConstraintDescriptor,
  type ConstraintEvaluator,
  type ConstraintRecord,
  type ConstraintRegistry,
  type ConstraintResult,
  type InspectResult,
  type RegisterResult
} from "./constraint";
export {
  COUNT_MARKER_KIND,
  COUNT_MARKER_VERSION,
  countMarkerEvaluator,
  countMarkerRecord,
  type CountMarker
} from "./count-marker";
export {
  countMarker,
  evaluateIdentity,
  evaluateOneMarked,
  RESOLUTION_SEMANTICS,
  type Evaluation,
  type EvaluatedValue,
  type MaterializeQuery,
  type QueryResult,
  type Requirement,
  type Sufficiency,
  type ValidityEnvelope
} from "./dynamics";
export {
  establishProposal,
  proposeBulk,
  proposeInteraction,
  type BulkProposal,
  type InteractionProposal,
  type ProposalResult
} from "./proposals";
export {
  coarsen,
  constrain,
  mergeBulks,
  refine,
  split,
  type OperationRejection,
  type OperationResult
} from "./operations";
export {
  continuityStatus,
  replay,
  type ContinuityStatus,
  type ReplayResult
} from "./replay";
export {
  countSnapshot,
  emptyRepresentation,
  representedMarkerCount,
  sameCounts,
  sameIdentities,
  totalCount,
  type Bulk,
  type CountSnapshot,
  type Individual,
  type Representation
} from "./representation";
