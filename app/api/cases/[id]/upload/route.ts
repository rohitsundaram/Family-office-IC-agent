import { NextResponse } from "next/server";
import path from "node:path";
import { promises as fs } from "node:fs";
import { addUploadedDoc, getCase } from "@/lib/sqlite";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await getCase(id);
  if (!existing) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Expected multipart form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field: file" }, { status: 400 });
  }

  const uploadDir = path.join(process.cwd(), ".data", "uploads", id);
  await fs.mkdir(uploadDir, { recursive: true });

  const filename = file.name || "upload.bin";
  const storedPath = path.join(uploadDir, `${Date.now()}-${filename}`);
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(storedPath, buf);

  const updated = await addUploadedDoc({ id, filename, storedPath });
  return NextResponse.json({ case: updated });
}
