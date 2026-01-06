import { z } from "zod";
import type { Decision } from "@/lib/models/decision";
import { DecisionSchema } from "@/lib/models/decision";
import { generateStructured, generateText } from "@/lib/pipeline/openai-client";

const MemoSchema = z.object({
  title: z.string(),
  body_md: z.string(),
});

export async function decideStep(params: {
  assetType: string;
  context: Record<string, unknown>;
  evidence: Array<{ id: string; excerpt: string; url?: string }>;
  constraintsSummary: Decision["constraints_summary"];
  model?: string;
}) {
  const model = params.model ?? "gpt-4.1-mini";
  const system =
    "You are an investment committee analyst. Produce a strict decision JSON and a memo. " +
    "Every material factual claim must be supported by citations mapping claim keys to evidence IDs provided. " +
    "Do not cite evidence IDs that are not provided.";

  const user = JSON.stringify(
    {
      assetType: params.assetType,
      context: params.context,
      constraints_summary: params.constraintsSummary,
      evidence: params.evidence.map((e) => ({ id: e.id, url: e.url, excerpt: e.excerpt.slice(0, 1200) })),
    },
    null,
    2,
  );

  const decision = await generateStructured({
    model,
    schema: DecisionSchema,
    schemaName: "Decision",
    system,
    user,
  });

  const memo = await generateStructured({
    model,
    schema: MemoSchema,
    schemaName: "ICMemo",
    system,
    user:
      user +
      "\n\nWrite a concise IC memo in markdown in body_md. Include sections: Summary, Thesis, Key Risks, Constraints, Evidence.",
  });

  const auditSummary = await generateText({
    model,
    system: "Summarize the decision in one sentence.",
    user: JSON.stringify({ recommendation: decision.recommendation, confidence: decision.confidence }),
  });

  return { decision, memo, auditSummary };
}
