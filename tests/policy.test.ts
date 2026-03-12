import { describe, expect, test } from "vitest";
import { decisionGate, evaluatePolicy } from "@/lib/policy/engine";

describe("policy engine", () => {
  test("breaches hard rule when below threshold", () => {
    const policy = {
      version: 1,
      rules: [
        {
          id: "vc.runway_months_min",
          severity: "hard" as const,
          path: "vc.runwayMonths",
          op: ">=" as const,
          value: 12,
          missing: "breach" as const,
        },
      ],
    };

    const { summary } = evaluatePolicy({ policy, context: { vc: { runwayMonths: 9 } } });
    expect(summary.breach).toBe(1);
  });

  test("missing metric uses rule.missing", () => {
    const policy = {
      version: 1,
      rules: [
        {
          id: "portfolio.position_cap",
          severity: "hard" as const,
          path: "portfolio.positionPct",
          op: "<=" as const,
          value: 0.1,
          missing: "warn" as const,
        },
      ],
    };

    const { summary, results } = evaluatePolicy({ policy, context: {} });
    expect(summary.warn).toBe(1);
    expect(results[0]?.details?.reason).toBe("missing");
  });

  test("decision gate prevents approve on breaches", () => {
    const decision = { recommendation: "approve", open_questions: [] as string[] };
    const gated = decisionGate(decision, {
      pass: 0,
      warn: 0,
      breach: 1,
      breaches: [{ ruleId: "re.dscr_min", status: "breach" }],
    });
    expect(gated.recommendation).not.toBe("approve");
    expect(gated.open_questions?.join(" ")).toContain("re.dscr_min");
  });
});

