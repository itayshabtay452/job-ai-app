import { NextResponse } from "next/server";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export const POST = withUser(async (req, { user }) => {
  const { id } = await req.json().catch(() => ({}));
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  const filePath = join(tmpdir(), `resume-${id}.pdf`);

  try {
    const buf = await readFile(filePath);
    const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
    const parsed = await pdfParse(buf);
    const text = (parsed.text || "").trim();
    const pageCount = parsed.numpages ?? 0;

    if (!text || text.length < 20) {
      return NextResponse.json({ ok: true, id, status: "needs_ocr", pageCount });
    }

    const resume = await prisma.resume.upsert({
      where: { userId: user.id },
      update: { text, skills: [], yearsExp: null },
      create: { userId: user.id, text, skills: [], yearsExp: null },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, resumeId: resume.id, pageCount, chars: text.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "parse error" }, { status: 500 });
  } finally {
    await unlink(filePath).catch(() => {});
  }
});
