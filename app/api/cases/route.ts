import { NextResponse } from "next/server";
import { createCase, listCases } from "@/lib/sqlite";

export const runtime = "nodejs";

export async function GET() {
  const cases = await listCases();
  return NextResponse.json({ cases });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | null
    | {
        assetType?: "pe_vc" | "public_equities" | "real_estate";
        title?: string;
        inputs?: Record<string, unknown>;
      };

  if (!body?.assetType) {
    return NextResponse.json(
      { error: "Missing required field: assetType" },
      { status: 400 },
    );
  }

  const record = await createCase({
    assetType: body.assetType,
    title: body.title,
    inputs: body.inputs ?? {},
  });

  return NextResponse.json({ case: record }, { status: 201 });
}
