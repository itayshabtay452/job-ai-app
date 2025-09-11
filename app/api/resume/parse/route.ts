import { NextResponse } from "next/server";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withUser(async (req, { user }) => {
  const { id } = await req.json().catch(() => ({}));
  if (!id || typeof id !== "string") {
    return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400 });
  }

  const filePath = join(tmpdir(), `resume-${id}.pdf`);

  let text = "";
  let pageCount: number | null = null;

  try {
    const buf = await readFile(filePath);
    const { default: pdfParse } = await import("pdf-parse");
    const parsed = await pdfParse(buf);
    text = (parsed.text || "").trim();
    pageCount = parsed.numpages ?? null;
  } catch {
    // אין קובץ זמני (serverless/אינסטנס אחר) — נטפל בהמשך
  } finally {
    // ניקוי best-effort (לא מפיל אם אין קובץ)
    await unlink(filePath).catch(() => {});
  }

  // ❌ בלי fallback לטקסט הישן: אם אין טקסט מה-PDF שהועלה עכשיו, מפסיקים כאן.
  if (!text) {
    return NextResponse.json(
      {
        ok: false,
        error: "MISSING_TMP_FILE",
        message:
          "לא נמצא קובץ זמני לניתוח (אחסון אפמרלי). נסה/י להעלות שוב ולנתח מיד לאחר ההעלאה.",
      },
      { status: 400 }
    );
  }

  // PDF בלי שכבת טקסט → מסמנים needs_ocr ומפסיקים (ה-UI כבר לא ירוץ ל-Analyze)
  if (text.length < 20) {
    return NextResponse.json({ ok: true, id, status: "needs_ocr", pageCount });
  }

  // שמירה: טקסט חדש, איפוס פרופיל ישן כדי להכריח Analyze מחודש
  const resume = await prisma.resume.upsert({
    where: { userId: user.id },
    update: { text, skills: [], yearsExp: null },
    create: { userId: user.id, text, skills: [], yearsExp: null },
    select: { id: true },
  });

  return NextResponse.json({
    ok: true,
    resumeId: resume.id,
    pageCount,
    chars: text.length,
  });
});
