"use client";

import { useMemo, useState } from "react";

type CaseRecord = {
  id: string;
  uploadedDocs: Array<{ filename: string; storedPath: string; uploadedAt: string }>;
  lastAnalysis?: { analyzedAt: string; status: "ok" | "error"; summary: string };
};

export function CaseActions({
  caseId,
  initialCase,
}: {
  caseId: string;
  initialCase: CaseRecord;
}) {
  const [c, setC] = useState<CaseRecord>(initialCase);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisJson, setAnalysisJson] = useState<string | null>(null);

  const last = useMemo(() => c.lastAnalysis, [c.lastAnalysis]);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch(`/api/cases/${caseId}/upload`, { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const data = (await res.json()) as { case: CaseRecord };
      setC(data.case);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function analyze() {
    setBusy(true);
    setError(null);
    setAnalysisJson(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/analyze`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const data = (await res.json()) as { case: CaseRecord; decision: unknown; memo: unknown };
      setC(data.case);
      setAnalysisJson(JSON.stringify({ decision: data.decision, memo: data.memo }, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analyze failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          border: "1px solid color-mix(in srgb, var(--foreground), transparent 80%)",
          borderRadius: 12,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.75 }}>
          Documents
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <input
            type="file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.currentTarget.value = "";
            }}
            disabled={busy}
          />
          <button
            type="button"
            onClick={() => void analyze()}
            disabled={busy}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid color-mix(in srgb, var(--foreground), transparent 70%)",
              background: "color-mix(in srgb, var(--foreground), transparent 88%)",
              cursor: busy ? "not-allowed" : "pointer",
              color: "var(--foreground)",
            }}
          >
            {busy ? "Working…" : "Analyze"}
          </button>
        </div>

        {c.uploadedDocs.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.75 }}>No uploads yet.</div>
        ) : (
          <ul style={{ marginLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            {c.uploadedDocs.map((d) => (
              <li key={d.storedPath} style={{ fontSize: 13 }}>
                {d.filename}{" "}
                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  ({new Date(d.uploadedAt).toLocaleString()})
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        style={{
          border: "1px solid color-mix(in srgb, var(--foreground), transparent 80%)",
          borderRadius: 12,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.75 }}>
          Latest analysis
        </div>

        {error ? (
          <div role="alert" style={{ fontSize: 13, opacity: 0.9 }}>
            {error}
          </div>
        ) : null}

        {last ? (
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            <div style={{ opacity: 0.8 }}>
              {last.status.toUpperCase()} • {new Date(last.analyzedAt).toLocaleString()}
            </div>
            <div>{last.summary}</div>
          </div>
        ) : (
          <div style={{ fontSize: 13, opacity: 0.75 }}>No analysis yet.</div>
        )}

        {analysisJson ? (
          <pre
            style={{
              marginTop: 6,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              borderRadius: 10,
              padding: 12,
              border: "1px solid color-mix(in srgb, var(--foreground), transparent 85%)",
            }}
          >
            {analysisJson}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
