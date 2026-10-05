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
        object: "?location",
      },
    ],

    then: {
      subject: "?holder",
      predicate: Relationship.CanOpen,
      object: "?location",
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
    object: null,
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
};

// ============================================================
// 5. QUERY ENGINE
// ============================================================

function matches(query, state) {
  return (
    (query.subject === null || state.subject === query.subject) &&
    (query.predicate === null || state.predicate === query.predicate) &&
    (query.object === null || state.object === query.object)
  );
}

function queryStates(query, states) {
  const collectedStates = [];

  for (const state of states) {
    if (matches(query, state)) {
      collectedStates.push(state);
    }
  }

  return collectedStates;
}

// ============================================================
// 6. VARIABLE / PATTERN ENGINE
// ============================================================

function isVariable(value) {
  return typeof value === "string" && value.startsWith("?");
}

function resolveValue(value, bindings) {
  if (isVariable(value)) {
    return bindings[value];
  }

  return value;
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

function resolvePattern(pattern, bindings) {
  return {
    subject: resolveValue(pattern.subject, bindings),
    predicate: resolveValue(pattern.predicate, bindings),
    object: resolveValue(pattern.object, bindings),
  };
}

function matchPattern(pattern, state, bindings) {
  return (
    matchValue(pattern.subject, state.subject, bindings) &&
    matchValue(pattern.predicate, state.predicate, bindings) &&
    matchValue(pattern.object, state.object, bindings)
  );
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

// ============================================================
// 8. EXPERIMENT: MANUALLY EXECUTE THE DATA-BASED RULE
// ============================================================

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

console.log(applyRule(Rules.HeldObjectLocation, states));
console.log(applyRule(Rules.CanOpen, states));
