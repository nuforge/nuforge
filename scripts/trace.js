// ============================================================
// 6. TRACE DISPLAY
// ============================================================

function describeValue(value) {
  return isVariable(value) ? value : value.name;
}

function describeAssertion(assertion) {
  return [assertion.subject, assertion.predicate, assertion.object]
    .map(describeValue)
    .join(" ");
}

function describeBindings(bindings) {
  return Object.entries(bindings)
    .map(([variable, value]) => `${variable}=${describeValue(value)}`)
    .join(", ");
}

function formatTrace(trace) {
  const lines = [];

  for (const entry of trace) {
    switch (entry.type) {
      case "resolution-start":
        lines.push(
          `resolution start: policy=${entry.policy}, ` +
            `pattern "${describeAssertion(entry.request.pattern)}", ` +
            `${entry.establishedCount} established (pass 0)`,
        );
        break;
      case "pass":
        lines.push(`pass ${entry.pass}: ${entry.accepted} accepted`);
        break;
      case "derivation":
        lines.push(
          `  [${entry.rule.name}] ` +
            (entry.accepted
              ? "accepted"
              : `rejected (${entry.rejectedBecause})`) +
            `: ${describeAssertion(entry.produced)}`,
        );
        lines.push(
          `    from: ${entry.matchedAssertions.map(describeAssertion).join("; ")}`,
        );
        lines.push(`    bindings: ${describeBindings(entry.bindings)}`);
        break;
      case "request-satisfied":
        lines.push(
          `request satisfied at pass ${entry.pass}: ` +
            entry.matches.map((m) => describeBindings(m.bindings)).join(" | "),
        );
        break;
      case "resolution-stop":
        lines.push(`resolution stop at pass ${entry.pass}: ${entry.reason}`);
        break;
    }
  }

  return lines.join("\n");
}