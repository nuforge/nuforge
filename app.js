// ============================================================
// 1. VOCABULARY
// ============================================================

const Entity = {
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
};

const Relationship = {
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
};

// ============================================================
// 2. ESTABLISHED STATE
// ============================================================

const states = [
  {
    subject: Entity.Alice,
    predicate: Relationship.Holding,
    object: Entity.Key,
  },
  {
    subject: Entity.Alice,
    predicate: Relationship.Holding,
    object: Entity.Book,
  },

  {
    subject: Entity.Alice,
    predicate: Relationship.IsIn,
    object: Entity.Library,
  },

  {
    subject: Entity.Key,
    predicate: Relationship.Opens,
    object: Entity.Vault,
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
        predicate: Relationship.Holding,
        object: "?held",
      },

      {
        subject: "?holder",
        predicate: Relationship.IsIn,
        object: "?location",
      },
    ],

    then: {
      subject: "?held",
      predicate: Relationship.IsIn,
      object: "?location",
    },
  },

  CanOpen: {
    name: "can-open",

    when: [
      {
        subject: "?holder",
        predicate: Relationship.Holding,
        object: "?held",
      },

      {
        subject: "?held",
        predicate: Relationship.Opens,
        object: "?target",
      },
    ],

    then: {
      subject: "?holder",
      predicate: Relationship.CanOpen,
      object: "?target",
    },
  },

  GrantAccess: {
    name: "grant-access",

    when: [
      {
        subject: "?item",
        predicate: Relationship.IsIn,
        object: "?location",
      },
      {
        subject: "?item",
        predicate: Relationship.Opens,
        object: "?target",
      },
    ],

    then: {
      subject: "?location",
      predicate: Relationship.GrantsAccess,
      object: "?target",
    },
  },
};

// ============================================================
// 4. QUERIES
// ============================================================

const Queries = {
  AliceLocation: {
    subject: Entity.Alice,
    predicate: Relationship.IsIn,
    object: "?location",
  },

  AliceHoldingKey: {
    subject: Entity.Alice,
    predicate: Relationship.Holding,
    object: Entity.Key,
  },

  KeyInLibrary: {
    subject: Entity.Key,
    predicate: Relationship.IsIn,
    object: Entity.Library,
  },
  LibraryGrantsAccessVault: {
    subject: Entity.Library,
    predicate: Relationship.GrantsAccess,
    object: Entity.Vault,
  },
};

const Requests = {
  AliceLocation: {
    pattern: Queries.AliceLocation,
    policy: "first",
  },

  EverythingAliceHolds: {
    pattern: {
      subject: Entity.Alice,
      predicate: Relationship.Holding,
      object: "?item",
    },
    policy: "all",
  },

  SomethingAliceHolds: {
    pattern: {
      subject: Entity.Alice,
      predicate: Relationship.Holding,
      object: "?item",
    },
    policy: "first",
  },
};

// ============================================================
// 5. QUERY ENGINE
// ============================================================

function queryStates(query, states) {
  return findPatternMatches(query, states, {});
}

// ============================================================
// 6. VARIABLE / PATTERN ENGINE
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

function matchPattern(pattern, state, bindings) {
  return (
    matchValue(pattern.subject, state.subject, bindings) &&
    matchValue(pattern.predicate, state.predicate, bindings) &&
    matchValue(pattern.object, state.object, bindings)
  );
}

function resolvePattern(pattern, bindings) {
  return {
    subject: resolveValue(pattern.subject, bindings),
    predicate: resolveValue(pattern.predicate, bindings),
    object: resolveValue(pattern.object, bindings),
  };
}

function findPatternMatches(pattern, states, bindings) {
  const patternMatches = [];

  for (const state of states) {
    const localBindings = { ...bindings };
    if (matchPattern(pattern, state, localBindings)) {
      patternMatches.push({ state, bindings: localBindings });
    }
  }

  return patternMatches;
}

function findRuleMatches(rule, states) {
  let paths = [
    {
      bindings: {},
      matchedStates: [],
    },
  ];

  for (const pattern of rule.when) {
    const nextPaths = [];

    for (const path of paths) {
      const patternMatches = findPatternMatches(pattern, states, path.bindings);

      for (const match of patternMatches) {
        nextPaths.push({
          bindings: match.bindings,
          matchedStates: [...path.matchedStates, match.state],
        });
      }
    }

    paths = nextPaths;
  }

  return paths;
}

function applyRule(rule, states) {
  const paths = findRuleMatches(rule, states);
  const derivedStates = [];
  for (const path of paths) {
    const derivedState = resolvePattern(rule.then, path.bindings);
    derivedState.provenance = {
      derived: true,
      rule: rule,
      derivedFrom: path.matchedStates,
    };
    derivedStates.push(derivedState);
  }
  return derivedStates;
}

function sameState(state1, state2) {
  return (
    state1.subject === state2.subject &&
    state1.predicate === state2.predicate &&
    state1.object === state2.object
  );
}

function hasState(states, candidate) {
  return states.some((state) => sameState(state, candidate));
}

function applyRulesOnce(rules, knownStates) {
  const newStates = [];

  for (const rule of Object.values(rules)) {
    const derivedStates = applyRule(rule, knownStates);

    for (const derivedState of derivedStates) {
      const alreadyKnown =
        hasState(knownStates, derivedState) ||
        hasState(newStates, derivedState);

      if (!alreadyKnown) {
        newStates.push(derivedState);
      }
    }
  }

  return newStates;
}

function deriveUntilStable(rules, initialStates) {
  let knownStates = [...initialStates];
  let newStates;
  do {
    newStates = applyRulesOnce(rules, knownStates);
    knownStates = [...knownStates, ...newStates];
  } while (newStates.length > 0);
  return knownStates;
}

function resolveQuery(query, rules, states) {
  let currentStates = [...states];
  let result = queryStates(query, currentStates);

  if (result.length > 0) {
    return result;
  }

  while (true) {
    const newStates = applyRulesOnce(rules, currentStates);

    if (newStates.length === 0) {
      return [];
    }

    currentStates = [...currentStates, ...newStates];
    result = queryStates(query, currentStates);

    if (result.length > 0) {
      return result;
    }
  }
}

function resolveFirst(pattern, rules, states) {
  return resolveQuery(pattern, rules, states);
}

function resolveRequest(request, rules, states) {
  if (request.policy === "first") {
    return resolveFirst(request.pattern, rules, states);
  }
  if (request.policy === "all") {
    const allStates = deriveUntilStable(rules, states);
    return queryStates(request.pattern, allStates);
  }

  throw new Error(`Unknown request policy: ${request.policy}`);
}

// ============================================================
// 8. RESOLUTION EXPERIMENT
// ============================================================

Relationship.Provides = {
  name: "provides",
  type: "relationship",
};

Rules.ProvidesMap = {
  name: "provides-map",

  when: [
    {
      subject: "?person",
      predicate: Relationship.IsIn,
      object: "?location",
    },
    {
      subject: "?location",
      predicate: Relationship.Provides,
      object: "?item",
    },
  ],
  then: {
    subject: "?person",
    predicate: Relationship.Holding,
    object: Entity.Map,
  },
};

states.push({
  subject: Entity.Library,
  predicate: Relationship.Provides,
  object: Entity.Map,
});

console.log(resolveRequest(Requests.SomethingAliceHolds, Rules, states));
console.log(resolveRequest(Requests.EverythingAliceHolds, Rules, states));
