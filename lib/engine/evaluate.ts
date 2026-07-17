import {
  PolicySchema,
  ProposedActionSchema,
  type Cond,
  type Decision,
  type DerivedFacts,
  type JsonValue,
  type Policy,
  type ProposedAction,
} from "../schemas";
import { canonicalize } from "./canonical";
import { deriveFacts, type DerivationContext } from "./derive";

export const ENGINE_VERSION = "0.1.0";

type EvaluationContext = {
  tool: string;
  args: Record<string, JsonValue>;
  derived: DerivedFacts;
};

export interface EvaluateOptions {
  timestamp: string;
  engineVersion?: string;
  derivationContext?: DerivationContext;
  derivedFacts?: DerivedFacts;
}

function getPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}

function count(value: unknown): number {
  if (typeof value === "string" || Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  throw new TypeError("count operators require a string, array, or object field");
}

function compareEqual(left: unknown, right: unknown): boolean {
  return canonicalize(left) === canonicalize(right);
}

function contains(container: unknown, sought: unknown): boolean {
  if (typeof container === "string" && typeof sought === "string") return container.includes(sought);
  if (Array.isArray(container)) return container.some((entry) => compareEqual(entry, sought));
  throw new TypeError("contains operators require a string or array field");
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  return value;
}

export function evaluateCondition(condition: Cond, context: EvaluationContext): boolean {
  if (condition.all !== null) {
    return condition.all.every((child) => evaluateCondition(child, context));
  }
  if (condition.any !== null) {
    return condition.any.some((child) => evaluateCondition(child, context));
  }
  if (condition.not !== null) {
    return !evaluateCondition(condition.not, context);
  }
  if (condition.field === null || condition.op === null) {
    throw new TypeError("Malformed leaf condition");
  }

  const actual = getPath(context, condition.field);
  const expected = condition.value;
  switch (condition.op) {
    case "eq":
      return compareEqual(actual, expected);
    case "neq":
      return !compareEqual(actual, expected);
    case "gt":
      return requireNumber(actual, "field") > requireNumber(expected, "value");
    case "gte":
      return requireNumber(actual, "field") >= requireNumber(expected, "value");
    case "lt":
      return requireNumber(actual, "field") < requireNumber(expected, "value");
    case "lte":
      return requireNumber(actual, "field") <= requireNumber(expected, "value");
    case "contains":
      return contains(actual, expected);
    case "not_contains":
      return !contains(actual, expected);
    case "in":
      if (!Array.isArray(expected)) throw new TypeError("in requires an array value");
      return expected.some((entry) => compareEqual(actual, entry));
    case "not_in":
      if (!Array.isArray(expected)) throw new TypeError("not_in requires an array value");
      return !expected.some((entry) => compareEqual(actual, entry));
    case "matches":
      if (typeof actual !== "string" || typeof expected !== "string") {
        throw new TypeError("matches requires string field and value");
      }
      return new RegExp(expected).test(actual);
    case "count_gt":
      return count(actual) > requireNumber(expected, "value");
    case "count_lte":
      return count(actual) <= requireNumber(expected, "value");
  }
}

const priority = { allow: 0, require_approval: 1, block: 2 } as const;

export function evaluatePolicy(
  policyInput: Policy,
  actionInput: ProposedAction,
  options: EvaluateOptions,
): Decision {
  let actionId = typeof actionInput?.id === "string" ? actionInput.id : "unknown";
  let policyVersion = typeof policyInput?.version === "number" ? policyInput.version : 0;

  try {
    const policy = PolicySchema.parse(policyInput);
    const action = ProposedActionSchema.parse(actionInput);
    actionId = action.id;
    policyVersion = policy.version;
    const derived = options.derivedFacts ?? deriveFacts(action, options.derivationContext);
    const context: EvaluationContext = { tool: action.tool, args: action.args, derived };
    const matchingRules = policy.rules.filter((rule) => {
      const inScope = rule.scope.tools.includes("*") || rule.scope.tools.includes(action.tool);
      return inScope && (rule.condition === null || evaluateCondition(rule.condition, context));
    });
    const enforced = matchingRules.filter((rule) => rule.enforcement === "enforce");
    const verdict = enforced.reduce<(typeof policy.rules)[number]["effect"]>(
      (current, rule) => (priority[rule.effect] > priority[current] ? rule.effect : current),
      "allow",
    );
    const unmatched = matchingRules.length === 0;

    return {
      action_id: action.id,
      verdict,
      matched_rule_ids: matchingRules.map((rule) => rule.id),
      explanation: unmatched
        ? "No policy rule matched; allowed by the documented unmatched default."
        : `Matched ${matchingRules.length} rule(s); deterministic precedence selected ${verdict}.`,
      policy_version: policy.version,
      engine_version: options.engineVersion ?? ENGINE_VERSION,
      timestamp: options.timestamp,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      action_id: actionId,
      verdict: "block",
      matched_rule_ids: [],
      explanation: `Engine error; failed closed: ${message}`,
      policy_version: policyVersion,
      engine_version: options.engineVersion ?? ENGINE_VERSION,
      timestamp: options.timestamp,
    };
  }
}
