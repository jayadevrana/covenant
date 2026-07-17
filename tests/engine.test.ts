import { describe, expect, it } from "vitest";

import { goldenExpectedVerdicts, goldenTrace, seedDerivationContext, seedPolicy } from "../data/seed";
import {
  CondSchema,
  PolicySchema,
  canonicalHash,
  canonicalize,
  deriveFacts,
  evaluateCondition,
  evaluatePolicy,
  type Cond,
  type Policy,
  type ProposedAction,
  type Rule,
} from "../lib/engine";

const timestamp = "2026-07-18T00:00:00.000Z";

function leaf(field: string, op: NonNullable<Cond["op"]>, value: Cond["value"]): Cond {
  return { all: null, any: null, not: null, field, op, value };
}

function baseAction(overrides: Partial<ProposedAction> = {}): ProposedAction {
  return {
    id: "action-test",
    run_id: "run-test",
    step: 0,
    tool: "send_email",
    args: {},
    purpose: "test",
    ...overrides,
  };
}

function baseRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: "rule-test",
    description: "Test rule",
    effect: "block",
    scope: { tools: ["send_email"] },
    condition: null,
    risk: "low",
    enforcement: "enforce",
    rationale: "Test coverage",
    ...overrides,
  };
}

function policyWith(...rules: Rule[]): Policy {
  return { id: "policy-test", version: 1, title: "Test", source_text: "test", rules };
}

const conditionContext = {
  tool: "send_email",
  args: {
    count: 6,
    subject: "Incident summary",
    tags: ["customer", "urgent"],
    status: "ready",
  },
  derived: {
    recipient_count: 6,
    external_domains: ["outside.example"],
    contains_customer_data: true,
    data_classes: ["customer_data"],
    attachment_names: ["report"],
  },
};

describe("condition operators", () => {
  const cases: Array<[NonNullable<Cond["op"]>, string, Cond["value"], boolean]> = [
    ["eq", "args.status", "ready", true],
    ["neq", "args.status", "draft", true],
    ["gt", "args.count", 5, true],
    ["gte", "args.count", 6, true],
    ["lt", "args.count", 7, true],
    ["lte", "args.count", 6, true],
    ["contains", "args.subject", "summary", true],
    ["not_contains", "args.subject", "secret", true],
    ["in", "args.status", ["ready", "sent"], true],
    ["not_in", "args.status", ["draft", "sent"], true],
    ["matches", "args.subject", "^Incident\\s", true],
    ["count_gt", "args.tags", 1, true],
    ["count_lte", "args.tags", 2, true],
  ];

  it.each(cases)("evaluates %s", (op, field, value, expected) => {
    expect(evaluateCondition(leaf(field, op, value), conditionContext)).toBe(expected);
  });

  it("evaluates all, any, and not predicate nodes", () => {
    const condition: Cond = {
      all: [
        leaf("args.count", "gte", 6),
        {
          all: null,
          any: [leaf("args.status", "eq", "draft"), leaf("args.status", "eq", "ready")],
          not: null,
          field: null,
          op: null,
          value: null,
        },
        {
          all: null,
          any: null,
          not: leaf("args.status", "eq", "sent"),
          field: null,
          op: null,
          value: null,
        },
      ],
      any: null,
      not: null,
      field: null,
      op: null,
      value: null,
    };

    expect(CondSchema.parse(condition)).toEqual(condition);
    expect(evaluateCondition(condition, conditionContext)).toBe(true);
  });
});

describe("policy evaluation semantics", () => {
  it("uses the most restrictive matching enforced verdict", () => {
    const policy = policyWith(
      baseRule({ id: "allow", effect: "allow" }),
      baseRule({ id: "approval", effect: "require_approval" }),
      baseRule({ id: "block", effect: "block" }),
    );
    const decision = evaluatePolicy(policy, baseAction(), { timestamp });

    expect(decision.verdict).toBe("block");
    expect(decision.matched_rule_ids).toEqual(["allow", "approval", "block"]);
  });

  it("allows unmatched actions with an explicit unmatched note", () => {
    const decision = evaluatePolicy(policyWith(), baseAction({ tool: "unknown_tool" }), { timestamp });

    expect(decision.verdict).toBe("allow");
    expect(decision.matched_rule_ids).toEqual([]);
    expect(decision.explanation).toContain("No policy rule matched");
  });

  it("fails closed when condition evaluation throws", () => {
    const brokenRegex = baseRule({ condition: leaf("args.subject", "matches", "[") });
    const decision = evaluatePolicy(
      policyWith(brokenRegex),
      baseAction({ args: { subject: "hello" } }),
      { timestamp },
    );

    expect(decision.verdict).toBe("block");
    expect(decision.explanation).toContain("failed closed");
  });

  it("records log-only matches without changing the verdict", () => {
    const decision = evaluatePolicy(
      policyWith(baseRule({ id: "observe", effect: "block", enforcement: "log_only" })),
      baseAction(),
      { timestamp },
    );

    expect(decision.verdict).toBe("allow");
    expect(decision.matched_rule_ids).toEqual(["observe"]);
  });

  it("produces the golden allow/approval/block sequence", () => {
    const actual = goldenTrace.map(
      (action) =>
        evaluatePolicy(seedPolicy, action, {
          timestamp,
          derivationContext: seedDerivationContext,
        }).verdict,
    );

    expect(actual).toEqual(goldenExpectedVerdicts);
  });
});

describe("derived facts, schemas, and canonical hashing", () => {
  it("derives recipient and customer-data facts without model input", () => {
    const facts = deriveFacts(goldenTrace[4], seedDerivationContext);

    expect(facts).toEqual({
      recipient_count: 1,
      external_domains: ["partnerco.example"],
      contains_customer_data: true,
      data_classes: ["customer_data"],
      attachment_names: ["july_12_incident_report"],
    });
  });

  it("validates the seven-rule fixture policy", () => {
    expect(PolicySchema.parse(seedPolicy).rules).toHaveLength(7);
  });

  it("canonicalizes sorted keys recursively and hashes deterministically", () => {
    const first = { z: 1, nested: { b: true, a: [2, 1] } };
    const second = { nested: { a: [2, 1], b: true }, z: 1 };

    expect(canonicalize(first)).toBe('{"nested":{"a":[2,1],"b":true},"z":1}');
    expect(canonicalHash(first)).toBe(canonicalHash(second));
    expect(canonicalHash(first)).toMatch(/^[a-f0-9]{64}$/);
  });
});
