import { PolicySchema, type Patch, type Policy } from "../schemas";

export function previewPatch(policy: Policy, patch: Patch): Policy {
  const rules = structuredClone(policy.rules);
  if (patch.type === "rule_add") {
    if (rules.some((rule) => rule.id === patch.rule.id)) {
      throw new Error(`Rule ${patch.rule.id} already exists`);
    }
    rules.push(structuredClone(patch.rule));
  } else {
    const index = rules.findIndex((rule) => rule.id === patch.rule.id);
    if (index < 0) throw new Error(`Rule ${patch.rule.id} does not exist`);
    rules[index] = structuredClone(patch.rule);
  }
  return PolicySchema.parse({ ...policy, version: policy.version + 1, rules });
}

export function approvePatch(policy: Policy, patch: Patch): { policy: Policy; patch: Patch } {
  return {
    policy: previewPatch(policy, patch),
    patch: { ...structuredClone(patch), status: "approved" },
  };
}

export function rejectPatch(policy: Policy, patch: Patch): { policy: Policy; patch: Patch } {
  return {
    policy,
    patch: { ...structuredClone(patch), status: "rejected" },
  };
}
