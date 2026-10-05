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

const bindings = {};

const firstMatches = findPatternMatches(
  Rules.HeldObjectLocation.when[0],
  states,
  {},
);

console.log("First matches:", firstMatches);

const ruleMatches = [];

for (const firstMatch of firstMatches) {
  const secondMatches = findPatternMatches(
    Rules.HeldObjectLocation.when[1],
    states,
    firstMatch.bindings,
  );

  for (const secondMatch of secondMatches) {
    ruleMatches.push({
      bindings: secondMatch.bindings,

      matchedStates: [firstMatch.state, secondMatch.state],
    });
  }
}
console.log("Rule matches:", ruleMatches);
