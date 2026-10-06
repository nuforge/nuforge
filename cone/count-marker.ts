import type {
  ConstraintEvaluator,
  ConstraintRecord,
  ConstraintResult
} from "./constraint";
import { cloneJsonValue, isJsonValue, type JsonValue } from "./json";

export const COUNT_MARKER_KIND = "count-marker";
export const COUNT_MARKER_VERSION = "1";

export interface CountMarker {
  readonly marker: string;
  readonly exactly: number;
}

export function countMarkerRecord(
  id: string,
  marker: string,
  exactly: number
): ConstraintRecord {
  return {
    id,
    kind: COUNT_MARKER_KIND,
    version: COUNT_MARKER_VERSION,
    parameters: { marker, exactly }
  };
}

export function copyConstraint(record: ConstraintRecord): ConstraintRecord {
  return {
    id: record.id,
    kind: record.kind,
    version: record.version,
    parameters: isJsonValue(record.parameters)
      ? cloneJsonValue(record.parameters)
      : record.parameters
  };
}

export function readCountMarker(
  record: ConstraintRecord
): CountMarker | "unreadable" | undefined {
  if (
    record.kind !== COUNT_MARKER_KIND ||
    record.version !== COUNT_MARKER_VERSION
  ) {
    return undefined;
  }
  const parameters = record.parameters;
  if (
    typeof parameters !== "object" ||
    parameters === null ||
    Array.isArray(parameters)
  ) {
    return "unreadable";
  }
  const marker = parameters.marker;
  const exactly = parameters.exactly;
  if (typeof marker !== "string" || marker.length === 0) return "unreadable";
  if (
    typeof exactly !== "number" ||
    !Number.isInteger(exactly) ||
    exactly < 0
  ) {
    return "unreadable";
  }
  return { marker, exactly };
}

export function countMarkerEvaluator(): ConstraintEvaluator {
  return {
    kind: COUNT_MARKER_KIND,
    version: COUNT_MARKER_VERSION,
    inspect(record) {
      const read = readCountMarker(record);
      const summary =
        read === undefined || read === "unreadable"
          ? "unreadable count"
          : `exactly ${read.exactly} have ${read.marker}`;
      return {
        id: record.id,
        kind: record.kind,
        version: record.version,
        summary
      };
    },
    evaluate(record, state): ConstraintResult {
      const read = readCountMarker(record);
      if (read === undefined || read === "unreadable") {
        return { status: "inapplicable", reason: "invalid-record" };
      }
      const marked = readMarkedCount(state);
      if (marked === undefined) {
        return { status: "inapplicable", reason: "invalid-state" };
      }
      if (marked === read.exactly) return { status: "satisfied" };
      return { status: "violated", reason: "count-mismatch" };
    }
  };
}

function readMarkedCount(state: JsonValue): number | undefined {
  if (typeof state === "number") return wholeCount(state);
  if (typeof state !== "object" || state === null || Array.isArray(state)) {
    return undefined;
  }
  return wholeCount(state.marked);
}

function wholeCount(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return undefined;
  }
  return value;
}
