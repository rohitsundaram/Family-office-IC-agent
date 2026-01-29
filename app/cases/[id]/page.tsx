import Link from "next/link";
import { notFound } from "next/navigation";
import { getCase } from "@/lib/sqlite";
import { CaseActions } from "@/components/case-actions";

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCase(id);
  if (!c) notFound();

  return (
    <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 980, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 12, opacity: 0.75 }}>{c.assetType}</div>
            <h1 style={{ fontSize: 22, letterSpacing: "-0.02em" }}>{c.title ?? c.id}</h1>
          </div>
          <Link href="/" style={{ textDecoration: "underline", opacity: 0.85 }}>
            Back
          </Link>
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
            Inputs
          </div>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              borderRadius: 10,
              padding: 12,
              border: "1px solid color-mix(in srgb, var(--foreground), transparent 85%)",
            }}
          >
            {JSON.stringify(c.inputs, null, 2)}
          </pre>
        </div>

        <CaseActions caseId={c.id} initialCase={c} />
      </div>
    </div>
  );
}
