// ============================================================
// 5. VARIABLE / PATTERN ENGINE
// ============================================================

function isVariable(value) {
  return typeof value === "string" && value.startsWith("?");
}

function matchValue(patternValue, stateValue, bindings) {
  if (!isVariable(patternValue)) {
    return patternValue === stateValue;
  }

  if (!Object.hasOwn(bindings, patternValue)) {
    bindings[patternValue] = stateValue;
    return true;
  }

  return bindings[patternValue] === stateValue;
}

function resolveValue(value, bindings) {
  if (isVariable(value)) {
    return bindings[value];
  }
  return value;
}

function matchPattern(pattern, assertion, bindings) {
  return (
    matchValue(pattern.subject, assertion.subject, bindings) &&
    matchValue(pattern.predicate, assertion.predicate, bindings) &&
    matchValue(pattern.object, assertion.object, bindings)
  );
}

function resolvePattern(pattern, bindings) {
  return {
    subject: resolveValue(pattern.subject, bindings),
    predicate: resolveValue(pattern.predicate, bindings),
    object: resolveValue(pattern.object, bindings),
  };
}

function findPatternMatches(pattern, assertions, bindings) {
  const patternMatches = [];

  for (const assertion of assertions) {
    const localBindings = { ...bindings };
    if (matchPattern(pattern, assertion, localBindings)) {
      patternMatches.push({ assertion, bindings: localBindings });
    }
  }

  return patternMatches;
}

function findRuleMatches(rule, assertions) {
  let paths = [
    {
      bindings: {},
      matchedAssertions: [],
    },
  ];

  for (const pattern of rule.when) {
    const nextPaths = [];

    for (const path of paths) {
      const patternMatches = findPatternMatches(
        pattern,
        assertions,
        path.bindings,
      );

      for (const match of patternMatches) {
        nextPaths.push({
          bindings: match.bindings,
          matchedAssertions: [...path.matchedAssertions, match.assertion],
        });
      }
    }

    paths = nextPaths;
  }

  return paths;
}

function applyRule(rule, assertions) {
  const paths = findRuleMatches(rule, assertions);
  const derivations = [];
  for (const path of paths) {
    const derivedAssertion = resolvePattern(rule.then, path.bindings);
    derivedAssertion.provenance = {
      derived: true,
      rule: rule,
      derivedFrom: path.matchedAssertions,
    };
    derivations.push({ path, derivedAssertion });
  }
  return derivations;
}

function sameAssertion(assertion1, assertion2) {
  return (
    assertion1.subject === assertion2.subject &&
    assertion1.predicate === assertion2.predicate &&
    assertion1.object === assertion2.object
  );
}

function hasAssertion(assertions, candidate) {
  return assertions.some((assertion) => sameAssertion(assertion, candidate));
}

function applyRulesOnce(rules, knownAssertions, pass) {
  const newAssertions = [];
  const derivationTrace = [];

  for (const rule of Object.values(rules)) {
    const derivations = applyRule(rule, knownAssertions);

    for (const { path, derivedAssertion } of derivations) {
      let rejectedBecause = null;
      if (hasAssertion(knownAssertions, derivedAssertion)) {
        rejectedBecause = "already-known";
      } else if (hasAssertion(newAssertions, derivedAssertion)) {
        rejectedBecause = "already-derived-this-pass";
      }

      const accepted = rejectedBecause === null;
      if (accepted) {
        newAssertions.push(derivedAssertion);
      }

      derivationTrace.push({
        type: "derivation",
        pass,
        rule,
        matchedAssertions: path.matchedAssertions,
        bindings: path.bindings,
        produced: derivedAssertion,
        accepted,
        rejectedBecause,
      });
    }
  }

  const trace = [
    { type: "pass", pass, accepted: newAssertions.length },
    ...derivationTrace,
  ];

  return { newAssertions, trace };
}

function deriveUntilStable(rules, initialAssertions) {
  let knownAssertions = [...initialAssertions];
  const trace = [];
  let pass = 0;
  let newAssertions;
  do {
    pass += 1;
    const passResult = applyRulesOnce(rules, knownAssertions, pass);
    newAssertions = passResult.newAssertions;
    trace.push(...passResult.trace);
    knownAssertions = [...knownAssertions, ...newAssertions];
  } while (newAssertions.length > 0);
  return { assertions: knownAssertions, trace, passes: pass };
}

function resolveRequest(request, rules, assertions) {
  const trace = [
    {
      type: "resolution-start",
      request,
      policy: request.policy,
      establishedCount: assertions.length,
    },
  ];

  if (request.policy === "first") {
    let currentAssertions = [...assertions];
    let pass = 0;

    while (true) {
      const matches = findPatternMatches(
        request.pattern,
        currentAssertions,
        {},
      );

      if (matches.length > 0) {
        trace.push({ type: "request-satisfied", pass, matches });
        trace.push({ type: "resolution-stop", pass, reason: "satisfied" });
        return { result: matches, trace };
      }

      pass += 1;
      const passResult = applyRulesOnce(rules, currentAssertions, pass);
      trace.push(...passResult.trace);

      if (passResult.newAssertions.length === 0) {
        trace.push({
          type: "resolution-stop",
          pass,
          reason: "stable-unsatisfied",
        });
        return { result: [], trace };
      }

      currentAssertions = [...currentAssertions, ...passResult.newAssertions];
    }
  }

  if (request.policy === "all") {
    const derived = deriveUntilStable(rules, assertions);
    trace.push(...derived.trace);

    const matches = findPatternMatches(request.pattern, derived.assertions, {});
    if (matches.length > 0) {
      trace.push({ type: "request-satisfied", pass: derived.passes, matches });
    }
    trace.push({
      type: "resolution-stop",
      pass: derived.passes,
      reason: "stable",
    });
    return { result: matches, trace };
  }

  throw new Error(`Unknown request policy: ${request.policy}`);
}