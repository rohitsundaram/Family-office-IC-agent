import { describe, expect, test } from "vitest";
import { DecisionSchema } from "@/lib/models/decision";

describe("schemas", () => {
  test("DecisionSchema validates a well-formed decision", () => {
    const decision = {
      recommendation: "more_diligence",
      confidence: 0.4,
      thesis: "Need more data.",
      risks: ["Insufficient evidence"],
      mitigations: ["Collect documents"],
      open_questions: ["What are the key KPIs?"],
      required_diligence: ["Provide financial statements"],
      constraints_summary: { pass: 1, warn: 0, breach: 0, breaches: [] },
      citations: { thesis: ["e1"] },
    };
    const parsed = DecisionSchema.parse(decision);
    expect(parsed.recommendation).toBe("more_diligence");
  });
});

