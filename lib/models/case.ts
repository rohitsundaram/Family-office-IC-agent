import { z } from "zod";

export const AssetTypeSchema = z.enum(["pe_vc", "public_equities", "real_estate"]);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const UploadedDocSchema = z.object({
  filename: z.string(),
  storedPath: z.string(),
  uploadedAt: z.string(),
});
export type UploadedDoc = z.infer<typeof UploadedDocSchema>;

export const LastAnalysisSchema = z.object({
  analyzedAt: z.string(),
  status: z.enum(["ok", "error"]),
  summary: z.string(),
});
export type LastAnalysis = z.infer<typeof LastAnalysisSchema>;

export const CaseSchema = z.object({
  id: z.string(),
  assetType: AssetTypeSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  title: z.string().optional(),
  inputs: z.record(z.string(), z.unknown()),
  uploadedDocs: z.array(UploadedDocSchema),
  lastAnalysis: LastAnalysisSchema.optional(),
});
export type CaseRecord = z.infer<typeof CaseSchema>;
