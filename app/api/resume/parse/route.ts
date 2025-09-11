import { NextResponse } from "next/server";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export const POST = withUser(async (req, { user }) => {
  const { id } = await req.json().catch(() => ({}));
  const filePath = id ? join(tmpdir(), `resume-${id}.pdf`) : null;

  try {
    // ניסיון לקרוא tmp אם נשלח id (לוקאל/CI). ב-Vercel לרוב זה לא קיים.
    let text = "";
    let pageCount: number | null = null;
    if (filePath) {
      try {
        const buf = await readFile(filePath);
        const { default: pdfParse } = await import("pdf-parse");
        const parsed = await pdfParse(buf);
        text = (parsed.text || "").trim();
        pageCount = parsed.numpages ?? 0;
      } catch {
        // מתעלמים – ניפול לפולבאק DB
      }
    }

    // ✅ פולבאק פרוד: אם אין קובץ זמני אבל יש כבר רשומה ב-DB (נוצרה ב-upload), החזר הצלחה
    if (!text) {
      const existing = await prisma.resume.findUnique({
        where: { userId: user.id },
        select: { id: true, text: true },
      });
      if (existing?.id && existing.text?.length) {
        return NextResponse.json({
          ok: true,
          resumeId: existing.id,
          pageCount,
          chars: existing.text.length,
        });
      }      // אם אין כלום – זו ממש שגיאת קלט
      return NextResponse.json({ error: "missing upload (ephemeral storage)" }, { status: 400 });
    }

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
    if (filePath) {
      try {
        await unlink(filePath);
      } catch {
        // ignore cleanup errors (e.g., ENOENT in serverless env)
      }
    }
  }
});
