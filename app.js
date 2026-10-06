// ============================================================
// 1. VOCABULARY
// ============================================================

const Term = {
  Alice: {
    name: "Alice",
    type: "person",
  },

  Library: {
    name: "Library",
    type: "location",
  },

  Key: {
    name: "key",
    type: "object",
  },
  Book: {
    name: "Book",
    type: "object",
  },

  Map: {
    name: "map",
    type: "object",
  },

  Vault: {
    name: "vault",
    type: "location",
  },
  Holding: {
    name: "holding",
    type: "relationship",
  },
  IsIn: {
    name: "in",
    type: "relationship",
  },

  Opens: {
    name: "opens",
    type: "relationship",
  },
  CanOpen: {
    name: "can open",
    type: "relationship",
  },
  GrantsAccess: {
    name: "grants access",
    type: "relationship",
  },
  Provides: {
    name: "provides",
    type: "relationship",
  },
};

// ============================================================
// 2. ESTABLISHED ASSERTIONS
// ============================================================

const assertions = [
  {
    subject: Term.Alice,
    predicate: Term.Holding,
    object: Term.Key,
  },
  {
    subject: Term.Alice,
    predicate: Term.Holding,
    object: Term.Book,
  },

  {
    subject: Term.Alice,
    predicate: Term.IsIn,
    object: Term.Library,
  },

  {
    subject: Term.Key,
    predicate: Term.Opens,
    object: Term.Vault,
  },
];

// ============================================================
// 3. RULES
// ============================================================

const Rules = {
  HeldObjectLocation: {
    name: "held-object-location",

    when: [
      {
        subject: "?holder",
        predicate: Term.Holding,
        object: "?held",
      },

      {
        subject: "?holder",
        predicate: Term.IsIn,
        object: "?location",
      },
    ],

    then: {
      subject: "?held",
      predicate: Term.IsIn,
      object: "?location",
    },
  },

  CanOpen: {
    name: "can-open",

    when: [
      {
        subject: "?holder",
        predicate: Term.Holding,
        object: "?held",
      },

      {
        subject: "?held",
        predicate: Term.Opens,
        object: "?target",
      },
    ],

    then: {
      subject: "?holder",
      predicate: Term.CanOpen,
      object: "?target",
    },
  },

  GrantAccess: {
    name: "grant-access",

    when: [
      {
        subject: "?item",
        predicate: Term.IsIn,
        object: "?location",
      },
      {
        subject: "?item",
        predicate: Term.Opens,
        object: "?target",
      },
    ],

    then: {
      subject: "?location",
      predicate: Term.GrantsAccess,
      object: "?target",
    },
  },
};

// ============================================================
// 4. REQUESTS
// ============================================================

const Requests = {
  AliceLocation: {
    pattern: {
      subject: Term.Alice,
      predicate: Term.IsIn,
      object: "?location",
    },
    policy: "first",
  },

  EverythingAliceHolds: {
    pattern: {
      subject: Term.Alice,
      predicate: Term.Holding,
      object: "?item",
    },
    policy: "all",
  },

  SomethingAliceHolds: {
    pattern: {
      subject: Term.Alice,
      predicate: Term.Holding,
      object: "?item",
    },
    policy: "first",
  },
};

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
  const derivedAssertions = [];
  for (const path of paths) {
    const derivedAssertion = resolvePattern(rule.then, path.bindings);
    derivedAssertion.provenance = {
      derived: true,
      rule: rule,
      derivedFrom: path.matchedAssertions,
    };
    derivedAssertions.push(derivedAssertion);
  }
  return derivedAssertions;
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

function applyRulesOnce(rules, knownAssertions) {
  const newAssertions = [];

  for (const rule of Object.values(rules)) {
    const derivedAssertions = applyRule(rule, knownAssertions);

    for (const derivedAssertion of derivedAssertions) {
      const alreadyKnown =
        hasAssertion(knownAssertions, derivedAssertion) ||
        hasAssertion(newAssertions, derivedAssertion);

      if (!alreadyKnown) {
        newAssertions.push(derivedAssertion);
      }
    }
  }

  return newAssertions;
}

function deriveUntilStable(rules, initialAssertions) {
  let knownAssertions = [...initialAssertions];
  let newAssertions;
  do {
    newAssertions = applyRulesOnce(rules, knownAssertions);
    knownAssertions = [...knownAssertions, ...newAssertions];
  } while (newAssertions.length > 0);
  return knownAssertions;
}

function resolveRequest(request, rules, assertions) {
  if (request.policy === "first") {
    let currentAssertions = [...assertions];
    let matches = findPatternMatches(request.pattern, currentAssertions, {});

    if (matches.length > 0) {
      return matches;
    }

    while (true) {
      const newAssertions = applyRulesOnce(rules, currentAssertions);

      if (newAssertions.length === 0) {
        return [];
      }

      currentAssertions = [...currentAssertions, ...newAssertions];
      matches = findPatternMatches(request.pattern, currentAssertions, {});

      if (matches.length > 0) {
        return matches;
      }
    }
  }

  if (request.policy === "all") {
    const allAssertions = deriveUntilStable(rules, assertions);
    return findPatternMatches(request.pattern, allAssertions, {});
  }

  throw new Error(`Unknown request policy: ${request.policy}`);
}

// ============================================================
// 8. RESOLUTION EXPERIMENT
// ============================================================

Rules.ProvidesMap = {
  name: "provides-map",

  when: [
    {
      subject: "?person",
      predicate: Term.IsIn,
      object: "?location",
    },
    {
      subject: "?location",
      predicate: Term.Provides,
      object: "?item",
    },
  ],
  then: {
    subject: "?person",
    predicate: Term.Holding,
    object: "?item",
  },
};

assertions.push({
  subject: Term.Library,
  predicate: Term.Provides,
  object: Term.Map,
});

console.log(resolveRequest(Requests.SomethingAliceHolds, Rules, assertions));
console.log(resolveRequest(Requests.EverythingAliceHolds, Rules, assertions));
