import path from "node:path";
import { promises as fs } from "node:fs";
import YAML from "yaml";

export type ConstraintStatus = "pass" | "warn" | "breach";

export type ConstraintResult = {
  ruleId: string;
  status: ConstraintStatus;
  details?: Record<string, unknown>;
};

type Rule = {
  id: string;
  description?: string;
  severity: "hard" | "soft";
  path: string;
  op: "<" | "<=" | ">" | ">=" | "==" | "!=";
  value: number | string | boolean;
  missing: "pass" | "warn" | "breach";
};

type Policy = {
  version: number;
  rules: Rule[];
};

export async function loadPolicy(): Promise<Policy> {
  const filePath = path.join(process.cwd(), "lib", "policy", "policy.yaml");
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = YAML.parse(raw) as Policy;
  if (!parsed?.rules || !Array.isArray(parsed.rules)) {
    throw new Error("Invalid policy.yaml: missing rules[]");
  }
  return parsed;
}

export function evaluatePolicy(params: { policy: Policy; context: Record<string, unknown> }) {
  const results: ConstraintResult[] = [];
  for (const rule of params.policy.rules) {
    const got = getByPath(params.context, rule.path);
    if (got === undefined || got === null) {
      results.push({
        ruleId: rule.id,
        status: rule.missing,
        details: { reason: "missing", path: rule.path, expected: rule.value, op: rule.op },
      });
      continue;
    }

    const ok = compare(got, rule.op, rule.value);
    results.push({
      ruleId: rule.id,
      status: ok ? "pass" : rule.severity === "hard" ? "breach" : "warn",
      details: ok
        ? { path: rule.path, op: rule.op, expected: rule.value }
        : { path: rule.path, op: rule.op, expected: rule.value, actual: got },
    });
  }

  const pass = results.filter((r) => r.status === "pass").length;
  const warn = results.filter((r) => r.status === "warn").length;
  const breach = results.filter((r) => r.status === "breach").length;
  const breaches = results.filter((r) => r.status === "breach");
  return { results, summary: { pass, warn, breach, breaches } };
}

function getByPath(obj: unknown, dotPath: string): unknown {
  const parts = dotPath.split(".").filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function compare(actual: unknown, op: Rule["op"], expected: Rule["value"]) {
  switch (op) {
    case "==":
      return actual === expected;
    case "!=":
      return actual !== expected;
    case "<":
    case "<=":
    case ">":
    case ">=": {
      const a = typeof actual === "number" ? actual : Number(actual);
      const e = typeof expected === "number" ? expected : Number(expected);
      if (Number.isNaN(a) || Number.isNaN(e)) return false;
      if (op === "<") return a < e;
      if (op === "<=") return a <= e;
      if (op === ">") return a > e;
      return a >= e;
    }
    default:
      return false;
  }
}

export function decisionGate<TDecision extends { recommendation: string; open_questions?: string[]; required_diligence?: string[] }>(
  decision: TDecision,
  constraints: { pass: number; warn: number; breach: number; breaches: ConstraintResult[] },
): TDecision {
  if (constraints.breach === 0) return decision;
  if (decision.recommendation !== "approve") return decision;

  const breachIds = constraints.breaches.map((b) => b.ruleId);
  return {
    ...decision,
    recommendation: "more_diligence",
    open_questions: [
      ...(decision.open_questions ?? []),
      `Approval gated by hard constraint breaches: ${breachIds.join(", ")}`,
    ],
    required_diligence: [
      ...(decision.required_diligence ?? []),
      "Resolve all hard constraint breaches (provide missing metrics / adjust sizing / re-underwrite).",
    ],
  };
}
