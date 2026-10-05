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

// matches checks if a given state matches a query, considering null as a wildcard.

function matches(query, state) {
  return (
    (query.subject === null || state.subject === query.subject) &&
    (query.predicate === null || state.predicate === query.predicate) &&
    (query.object === null || state.object === query.object)
  );
}

// queryStates takes a query and a list of states, and returns all states that match the query.

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

// isVariable checks if a given value is a variable (starts with "?").

function isVariable(value) {
  return typeof value === "string" && value.startsWith("?");
}

// resolveValue takes a value and bindings, and returns the resolved value if it's a variable, or the original value otherwise.

function resolveValue(value, bindings) {
  if (isVariable(value)) {
    return bindings[value];
  }

  return value;
}

// matchValue checks if a pattern value matches a state value given the current bindings.

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

// resolvePattern takes a pattern and bindings, and returns a new pattern with all variables resolved to their bound values.

function resolvePattern(pattern, bindings) {
  return {
    subject: resolveValue(pattern.subject, bindings),
    predicate: resolveValue(pattern.predicate, bindings),
    object: resolveValue(pattern.object, bindings),
  };
}

// matchPattern checks if a given state matches a pattern with the provided bindings.

function matchPattern(pattern, state, bindings) {
  return (
    matchValue(pattern.subject, state.subject, bindings) &&
    matchValue(pattern.predicate, state.predicate, bindings) &&
    matchValue(pattern.object, state.object, bindings)
  );
}

// findPatternMatches is a utility function to find all states that match a given pattern with the provided bindings.

function findPatternMatches(pattern, states, bindings) {
  const matches = [];

  for (const state of states) {
    const localBindings = { ...bindings };
    try {
      if (matchPattern(pattern, state, localBindings)) {
        matches.push({ state, bindings: localBindings });
      }
    } catch (error) {
      // Ignore errors and continue with the next state
    }
  }
  console.log("Pattern matches:", matches);

  return matches;
}


// ============================================================
// 8. EXPERIMENT: MANUALLY EXECUTE THE DATA-BASED RULE
// ============================================================

const bindings = {};

findPatternMatches(Rules.HeldObjectLocation.when[0], states, bindings);
