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

function matchPattern(pattern, state, bindings) {
  return (
    matchValue(pattern.subject, state.subject, bindings) &&
    matchValue(pattern.predicate, state.predicate, bindings) &&
    matchValue(pattern.object, state.object, bindings)
  );
}

function resolveValue(value, bindings) {
  if (isVariable(value)) {
    return bindings[value];
  }

  return value;
}

function resolvePattern(pattern, bindings) {
  return {
    subject: resolveValue(pattern.subject, bindings),
    predicate: resolveValue(pattern.predicate, bindings),
    object: resolveValue(pattern.object, bindings),
  };
}

// ============================================================
// 7. OLD HARD-CODED RULE
// Reference implementation only.
// ============================================================

function deriveHeldObjectLocations(states) {
  const heldObjectLocations = [];

  for (const holdingState of states) {
    if (holdingState.predicate !== Relationship.Holding) {
      continue;
    }

    const heldObject = holdingState.object;
    const holder = holdingState.subject;

    for (const locationState of states) {
      if (
        locationState.subject === holder &&
        locationState.predicate === Relationship.IsIn
      ) {
        heldObjectLocations.push({
          subject: heldObject,
          predicate: Relationship.IsIn,
          object: locationState.object,

          provenance: {
            derived: true,
            rule: Rules.HeldObjectLocation,
            derivedFrom: [holdingState, locationState],
          },
        });
      }
    }
  }

  return heldObjectLocations;
}

// ============================================================
// 8. EXPERIMENT: MANUALLY EXECUTE THE DATA-BASED RULE
// ============================================================

const bindings = {};

const firstMatch = matchPattern(
  Rules.HeldObjectLocation.when[0],
  states[0],
  bindings,
);

console.log("First pattern matched:", firstMatch);
console.log("Bindings:", bindings);

const secondMatch = matchPattern(
  Rules.HeldObjectLocation.when[1],
  states[1],
  bindings,
);

console.log("Second pattern matched:", secondMatch);
console.log("Bindings:", bindings);

const derivedPattern = resolvePattern(Rules.HeldObjectLocation.then, bindings);

console.log("Resolved THEN pattern:", derivedPattern);

// ============================================================
// 9. COMPARE AGAINST OLD IMPLEMENTATION
// ============================================================

const oldDerivedStates = deriveHeldObjectLocations(states);

console.log("Old hard-coded result:", oldDerivedStates);
console.log("New pattern-based result:", derivedPattern);
