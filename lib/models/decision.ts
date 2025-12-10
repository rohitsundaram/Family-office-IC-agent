import { z } from "zod";

export const RecommendationSchema = z.enum(["approve", "reject", "more_diligence"]);

export const ConstraintResultSchema = z.object({
  ruleId: z.string(),
  status: z.enum(["pass", "warn", "breach"]),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const ConstraintsSummarySchema = z.object({
  pass: z.number().int().nonnegative(),
  warn: z.number().int().nonnegative(),
  breach: z.number().int().nonnegative(),
  breaches: z.array(ConstraintResultSchema),
});

export const DecisionSchema = z.object({
  recommendation: RecommendationSchema,
  confidence: z.number().min(0).max(1),
  thesis: z.string(),
  risks: z.array(z.string()),
  mitigations: z.array(z.string()),
  open_questions: z.array(z.string()),
  required_diligence: z.array(z.string()).optional(),
  constraints_summary: ConstraintsSummarySchema,
  citations: z.record(z.string(), z.array(z.string())),
});

export type Decision = z.infer<typeof DecisionSchema>;
