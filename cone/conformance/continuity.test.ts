import { describe, expect, it } from "vitest";
import { createContinuityRef, sameContinuity } from "../index";

describe("continuity identity", () => {
  it("treats the id as identity and the kind as a label", () => {
    const alpha = createContinuityRef("unit-1", "alpha");
    const beta = createContinuityRef("unit-1", "beta");
    const other = createContinuityRef("unit-2", "alpha");
    expect(alpha.ok && beta.ok && other.ok).toBe(true);
    if (!alpha.ok || !beta.ok || !other.ok) return;

    expect(sameContinuity(alpha.continuity, beta.continuity)).toBe(true);
    expect(alpha.continuity).not.toEqual(beta.continuity);
    expect(sameContinuity(alpha.continuity, other.continuity)).toBe(false);
  });

  it("rejects an empty id or an empty kind", () => {
    expect(createContinuityRef("")).toEqual({
      ok: false,
      reason: "empty-id"
    });
    expect(createContinuityRef("unit-1", "")).toEqual({
      ok: false,
      reason: "empty-kind"
    });
  });

  it("round-trips through JSON", () => {
    const created = createContinuityRef("unit-1");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(JSON.parse(JSON.stringify(created.continuity))).toEqual(
      created.continuity
    );
  });
});
