import { z } from "zod";
import type { AssetType } from "@/lib/models/case";
import { generateStructured } from "@/lib/pipeline/openai-client";

const ExtractSchema = z.object({
  portfolio: z
    .object({
      positionPct: z.number().optional(),
      illiquidsPct: z.number().optional(),
    })
    .optional(),
  vc: z
    .object({
      runwayMonths: z.number().optional(),
    })
    .optional(),
  public: z
    .object({
      advUsd: z.number().optional(),
    })
    .optional(),
  re: z
    .object({
      dscr: z.number().optional(),
      ltv: z.number().optional(),
    })
    .optional(),
  notes: z.array(z.string()).default([]),
});

export type Extracted = z.infer<typeof ExtractSchema>;

export async function extractStep(params: {
  assetType: AssetType;
  inputs: Record<string, unknown>;
  evidence: Array<{ id: string; excerpt: string; url?: string }>;
  model?: string;
}): Promise<Extracted> {
  const model = params.model ?? "gpt-4.1-mini";
  const system =
    "You extract structured underwriting-relevant fields from the provided inputs/evidence. " +
    "If a value is not present, omit it. Do not guess.";
  const user = JSON.stringify(
    {
      assetType: params.assetType,
      inputs: params.inputs,
      evidence: params.evidence.map((e) => ({ id: e.id, url: e.url, excerpt: e.excerpt.slice(0, 1200) })),
    },
    null,
    2,
  );
  return await generateStructured({
    model,
    schema: ExtractSchema,
    schemaName: "ExtractedKPIs",
    system,
    user,
  });
}
