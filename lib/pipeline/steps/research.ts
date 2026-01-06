import { randomUUID } from "node:crypto";
import path from "node:path";
import { promises as fs } from "node:fs";
import { addEvidence } from "@/lib/sqlite";

export async function researchStep(params: {
  caseId: string;
  inputs: Record<string, unknown>;
  uploadedDocs: Array<{ filename: string; storedPath: string }>;
}) {
  const evidenceIds: string[] = [];

  const urls = Array.isArray(params.inputs.researchUrls) ? (params.inputs.researchUrls as unknown[]) : [];
  for (const u of urls) {
    if (typeof u !== "string") continue;
    const url = u;
    try {
      const res = await fetch(url, { redirect: "follow" });
      const html = await res.text();
      const excerpt = html.replace(/\s+/g, " ").slice(0, 800);
      const id = randomUUID();
      await addEvidence({
        id,
        caseId: params.caseId,
        sourceType: "web",
        url,
        excerpt,
      });
      evidenceIds.push(id);
    } catch {
      // ignore failed fetches (keeps pipeline robust)
    }
  }

  for (const doc of params.uploadedDocs) {
    const ext = path.extname(doc.filename).toLowerCase();
    let excerpt = `Uploaded file: ${doc.filename}`;
    if ([".txt", ".md", ".csv", ".json"].includes(ext)) {
      try {
        const raw = await fs.readFile(doc.storedPath, "utf8");
        excerpt = raw.slice(0, 2000);
      } catch {
        // keep default excerpt
      }
    }
    const id = randomUUID();
    await addEvidence({
      id,
      caseId: params.caseId,
      sourceType: "upload",
      excerpt,
    });
    evidenceIds.push(id);
  }

  return { evidenceIds };
}
