import { z } from "zod";

export const AuditEventSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  stepName: z.string(),
  inputHash: z.string(),
  outputSummary: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;
