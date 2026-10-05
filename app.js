let Entity = {
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

let Relationship = {
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

let grammarTenses = { past: "was", present: "is", future: "will be" };

let states = [
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

// Queries

let QuAliceIsInLibrary = {
  subject: Entity.Alice,
  predicate: Relationship.IsIn,
  object: null,
};

let QuAliceHoldingKey = {
  subject: Entity.Alice,
  predicate: Relationship.Holding,
  object: Entity.Key,
};

let QuKeyIsInLibrary = {
  subject: Entity.Key,
  predicate: Relationship.IsIn,
  object: Entity.Library,
};

let Queries = [QuAliceIsInLibrary, QuKeyIsInLibrary, QuAliceHoldingKey];
let ruleHeldObjectLocation = "held-object-location";

let matches = (Qu, state) => {
  if (
    (Qu.subject === null || state.subject === Qu.subject) &&
    (Qu.predicate === null || state.predicate === Qu.predicate) &&
    (Qu.object === null || state.object === Qu.object)
  ) {
    return true;
  }
  return false;
};

let QueryStates = (Qu, states) => {
  let collectedStates = [];
  for (let state of states) {
    if (matches(Qu, state)) {
      collectedStates.push(state);
    }
  }
  return collectedStates;
};


function deriveHeldObjectLocations(states) {
  let heldObjectLocations = [];

  for (let state of states) {
    if (state.predicate === Relationship.Holding) {
      let heldObject = state.object;
      let holder = state.subject;
      for (let locationState of states) {
        if (
          locationState.subject === holder &&
          locationState.predicate === Relationship.IsIn
        ) {
          heldObjectLocations.push({
            subject: heldObject,
            predicate: Relationship.IsIn,
            object: locationState.object,
            derivedFrom: recordMetaData(heldObject, locationState),
          });
        }
      }
    }
  }
  return heldObjectLocations;
}

function recordMetaData(heldObject, locationState) {
  const metadata = {
    derived: true,
    rule: ruleHeldObjectLocation,
    derivedFrom: [heldObject, locationState.object],
  };
  return metadata;
}

for (let query of Queries) {
  let matchingStates = QueryStates(query, states);
  console.log("Query:", matchingStates);
}

console.log("Derived:", deriveHeldObjectLocations(states));
