import { NextResponse } from "next/server";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

// מזהה זמני חוקי: לא ריק, מחרוזת, ללא מפרידי נתיב
function isValidTempId(id: unknown): id is string {
  if (typeof id !== "string") return false;
  if (!id || /[\\/]/.test(id)) return false; // אין / או \  (מונע שימוש בנתיב)
  if (id.length < 8) return false;
  return true;
}

export const POST = withUser(async (req, { user }) => {
  let filePath: string | null = null;

  try {
    const body = await req.json().catch(() => ({} as any));
    const id = body?.id;

    if (!isValidTempId(id)) {
      // לא מקבלים נתיבי קבצים או ערכים קצרים/ריקים
      return NextResponse.json({ ok: false, error: "INVALID_TEMP_ID" }, { status: 400 });
    }

    // הקובץ הועלה קודם ל-tmp ב-upload/route.ts בשם resume-<id>.pdf
    filePath = join(tmpdir(), `resume-${id}.pdf`);

    // קוראים את ה-PDF הזמני
    const buf = await readFile(filePath).catch((e: any) => {
      if (e?.code === "ENOENT") {
        // לא נמצא קובץ זמני — בקש מהלקוח להעלות שוב
        return null;
      }
      throw e;
    });

    if (!buf) {
      return NextResponse.json(
        { ok: false, error: "TEMP_FILE_NOT_FOUND" },
        { status: 404 }
      );
    }

    // pdf-parse על Buffer
    const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
    const parsed = await pdfParse(buf);
    const text = (parsed.text || "").trim();
    const pageCount = parsed.numpages ?? 0;

    if (!text || text.length < 20) {
      // PDF בלי שכבת טקסט → צריך OCR בשלבים הבאים
      return NextResponse.json({ ok: true, id, status: "needs_ocr", pageCount });
    }

    // שומרים / מעדכנים את ה-Resume למשתמש
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
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "parse error" },
      { status: 500 }
    );
  } finally {
    // מחיקה בטוחה של הקובץ הזמני (אם נוצר נתיב)
    if (filePath) {
      try { await unlink(filePath); } catch { /* ignore */ }
    }
  }
});
