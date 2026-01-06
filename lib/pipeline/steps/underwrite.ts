import type { AssetType } from "@/lib/models/case";
import type { Extracted } from "@/lib/pipeline/steps/extract";

export type UnderwriteResult = {
  context: Record<string, unknown>;
  summaryLines: string[];
};

export async function underwriteStep(params: { assetType: AssetType; inputs: Record<string, unknown>; extracted: Extracted }): Promise<UnderwriteResult> {
  const context: Record<string, unknown> = {
    ...(params.inputs ?? {}),
    ...(params.extracted ?? {}),
  };

  const summaryLines: string[] = [];
  if (params.assetType === "real_estate") {
    const re = (context.re ?? {}) as Record<string, unknown>;
    if (typeof re.dscr === "number") summaryLines.push(`DSCR: ${re.dscr}`);
    if (typeof re.ltv === "number") summaryLines.push(`LTV: ${re.ltv}`);
  }
  if (params.assetType === "pe_vc") {
    const vc = (context.vc ?? {}) as Record<string, unknown>;
    if (typeof vc.runwayMonths === "number") summaryLines.push(`Runway (months): ${vc.runwayMonths}`);
  }
  if (params.assetType === "public_equities") {
    const pub = (context.public ?? {}) as Record<string, unknown>;
    if (typeof pub.advUsd === "number") summaryLines.push(`ADV (USD): ${pub.advUsd}`);
  }

  return { context, summaryLines };
}
