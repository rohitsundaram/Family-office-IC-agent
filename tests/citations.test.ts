import { describe, expect, test } from "vitest";
import { DecisionSchema } from "@/lib/models/decision";

describe("citations", () => {
  test("citations reference only existing evidence ids", () => {
    const evidenceIds = new Set(["ev1", "ev2"]);
    const decision = DecisionSchema.parse({
      recommendation: "reject",
      confidence: 0.6,
      thesis: "Risk outweighs return.",
      risks: ["Leverage too high"],
      mitigations: ["Reduce leverage"],
      open_questions: [],
      constraints_summary: {
        pass: 0,
        warn: 0,
        breach: 1,
        breaches: [{ ruleId: "re.ltv_max", status: "breach" }],
      },
      citations: {
        thesis: ["ev1"],
        risk_1: ["ev2"],
      },
    });

    const all = Object.values(decision.citations).flat();
    expect(all.every((id) => evidenceIds.has(id))).toBe(true);
  });
});

