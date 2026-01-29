import { NextResponse } from "next/server";
import { analyzeCase } from "@/lib/pipeline/analyze-case";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const out = await analyzeCase(id);
    if (!out.case) return NextResponse.json({ error: "Case not found" }, { status: 404 });
    return NextResponse.json(out);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analyze failed" },
      { status: 500 },
    );
  }
}
