import { createHash } from "node:crypto";
import {
  getCase,
  listAuditEvents,
  listEvidence,
  setLastAnalysis,
  upsertAnalysis,
  addAuditEvent,
  finishAuditEvent,
} from "@/lib/sqlite";
import { loadPolicy, evaluatePolicy, decisionGate } from "@/lib/policy/engine";
import { researchStep } from "@/lib/pipeline/steps/research";
import { extractStep } from "@/lib/pipeline/steps/extract";
import { underwriteStep } from "@/lib/pipeline/steps/underwrite";
import { decideStep } from "@/lib/pipeline/steps/decide";
import { DecisionSchema } from "@/lib/models/decision";

function hashJson(x: unknown) {
  return createHash("sha256").update(JSON.stringify(x)).digest("hex");
}

function sanitizeCitations(decision: unknown, evidenceIds: Set<string>) {
  const parsed = DecisionSchema.safeParse(decision);
  if (!parsed.success) return decision;
  const d = parsed.data;
  const citations: Record<string, string[]> = {};
  for (const [k, ids] of Object.entries(d.citations ?? {})) {
    citations[k] = ids.filter((id) => evidenceIds.has(id));
  }
  return { ...d, citations };
}

export async function analyzeCase(caseId: string) {
  const c = await getCase(caseId);
  if (!c) throw new Error("Case not found");

  const policy = await loadPolicy();

  const researchAudit = await addAuditEvent({
    caseId,
    stepName: "research",
    inputHash: hashJson({ inputs: c.inputs, uploadedDocs: c.uploadedDocs }),
    outputSummary: "Started",
  });
  const researchOut = await researchStep({
    caseId,
    inputs: c.inputs,
    uploadedDocs: c.uploadedDocs.map((d) => ({ filename: d.filename, storedPath: d.storedPath })),
  });
  await finishAuditEvent({
    id: researchAudit.id,
    outputSummary: `Stored ${researchOut.evidenceIds.length} evidence items`,
  });

  const evidence = await listEvidence(caseId);

  const extractAudit = await addAuditEvent({
    caseId,
    stepName: "extract",
    inputHash: hashJson({ assetType: c.assetType, inputs: c.inputs, evidenceCount: evidence.length }),
    outputSummary: "Started",
  });
  let extracted: Awaited<ReturnType<typeof extractStep>> | null = null;
  try {
    extracted = await extractStep({
      assetType: c.assetType,
      inputs: c.inputs,
      evidence: evidence.map((e) => ({ id: e.id, excerpt: e.excerpt, url: e.url })),
    });
    await finishAuditEvent({ id: extractAudit.id, outputSummary: `Extracted fields: ${Object.keys(extracted ?? {}).join(", ")}` });
  } catch (err) {
    await finishAuditEvent({ id: extractAudit.id, outputSummary: `Extraction failed (missing OPENAI_API_KEY?): ${String(err)}` });
    extracted = { notes: ["Extraction unavailable; set OPENAI_API_KEY to enable."] };
  }

  const underwriteAudit = await addAuditEvent({
    caseId,
    stepName: "underwrite",
    inputHash: hashJson({ assetType: c.assetType, extracted }),
    outputSummary: "Started",
  });
  const underwrite = await underwriteStep({
    assetType: c.assetType,
    inputs: c.inputs,
    extracted: extracted ?? { notes: [] },
  });
  await finishAuditEvent({
    id: underwriteAudit.id,
    outputSummary: underwrite.summaryLines.length ? underwrite.summaryLines.join("; ") : "Underwrite complete",
  });

  const policyEval = evaluatePolicy({ policy, context: underwrite.context });

  const decideAudit = await addAuditEvent({
    caseId,
    stepName: "decide",
    inputHash: hashJson({ context: underwrite.context, evidenceCount: evidence.length, constraints: policyEval.summary }),
    outputSummary: "Started",
  });

  let decision: unknown;
  let memo: { title: string; body_md: string };
  let decisionSummary = "Decision unavailable";

  try {
    const out = await decideStep({
      assetType: c.assetType,
      context: underwrite.context,
      evidence: evidence.map((e) => ({ id: e.id, excerpt: e.excerpt, url: e.url })),
      constraintsSummary: policyEval.summary,
    });
    decision = out.decision;
    memo = out.memo;
    decisionSummary = out.auditSummary;
  } catch (err) {
    decision = {
      recommendation: "more_diligence",
      confidence: 0.2,
      thesis: "LLM decision synthesis unavailable; set OPENAI_API_KEY to enable.",
      risks: ["No decision synthesis available"],
      mitigations: ["Set OPENAI_API_KEY and rerun analyze"],
      open_questions: ["Provide additional inputs and documents"],
      required_diligence: ["Provide underwriting data"],
      constraints_summary: policyEval.summary,
      citations: {},
    };
    memo = { title: c.title ?? `Case ${c.id}`, body_md: "Decision synthesis unavailable." };
    decisionSummary = `Fallback decision due to error: ${String(err)}`;
  }

  const gated = decisionGate(
    decision as { recommendation: string; open_questions?: string[]; required_diligence?: string[] },
    policyEval.summary,
  );

  const evidenceIds = new Set(evidence.map((e) => e.id));
  const sanitized = sanitizeCitations({ ...gated, constraints_summary: policyEval.summary }, evidenceIds);

  await finishAuditEvent({ id: decideAudit.id, outputSummary: decisionSummary });

  const decisionJson = JSON.stringify(sanitized, null, 2);
  const memoMd = memo.body_md;
  await upsertAnalysis({ caseId, decisionJson, memoMd });

  const rec =
    sanitized && typeof sanitized === "object" && "recommendation" in sanitized
      ? String((sanitized as { recommendation?: unknown }).recommendation ?? "unknown")
      : "unknown";
  const summary = `Ran pipeline: evidence=${evidence.length}, breaches=${policyEval.summary.breach}, recommendation=${rec}`;
  await setLastAnalysis({ id: caseId, status: "ok", summary });

  const audit = await listAuditEvents(caseId);
  return { case: await getCase(caseId), decision: sanitized, memo: { title: memo.title, body: memoMd }, evidence, audit };
}
