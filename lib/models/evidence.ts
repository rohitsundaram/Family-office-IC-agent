import { z } from "zod";

export const EvidenceSourceTypeSchema = z.enum(["upload", "web"]);
export type EvidenceSourceType = z.infer<typeof EvidenceSourceTypeSchema>;

export const EvidenceItemSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  sourceType: EvidenceSourceTypeSchema,
  url: z.string().url().optional(),
  excerpt: z.string(),
  retrievedAt: z.string(),
});
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
