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