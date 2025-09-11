// app/api/resume/upload/route.ts
import { NextResponse } from "next/server";
import { withUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(code: string, status = 400, extra?: Record<string, any>) {
  return NextResponse.json({ ok: false, error: code, code, ...extra }, { status });
}

export const POST = withUser(async (req, { user }) => {
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (!ct.includes("multipart/form-data")) return bad("INVALID_CONTENT_TYPE", 415, { ct });

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return bad("FORMDATA_PARSE_FAILED", 400);
    }

    const file = form.get("file");
    if (!(file instanceof File)) return bad("MISSING_FILE", 400);

    const filename = file.name || "resume.pdf";
    const size = file.size ?? 0;
    if (size <= 0) return bad("EMPTY_FILE", 400);
    if (size > 5 * 1024 * 1024) return bad("FILE_TOO_LARGE", 400, { max: 5 * 1024 * 1024 });

    const lower = filename.toLowerCase();
    if (!lower.endsWith(".pdf")) return bad("ONLY_PDF_ALLOWED", 400, { filename });

    const buf = Buffer.from(await file.arrayBuffer());

    // חתימת PDF בסיסית
    const header = buf.subarray(0, 4).toString("utf8");
    if (!header.startsWith("%PDF")) return bad("INVALID_PDF_SIGNATURE", 400);

    // 🔍 פירוק PDF ישירות מה־Buffer (ללא גישת קבצים)
    // ב-Next.js על Node לפעמים עדיף המודול הזה:
    const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");
    let text = "";
    let pageCount = 0;
    try {
      const parsed = await pdfParse(buf);
      text = (parsed.text || "").trim();
      pageCount = parsed.numpages ?? 0;
    } catch (e: any) {
      // לא נפליל את המשתמש; אם לא הצלחנו לחלץ טקסט, נסמן needs_ocr
      return NextResponse.json({ ok: true, id: "", status: "needs_ocr", pageCount: null });
    }

    if (!text || text.length < 20) {
      // קובץ כנראה סרוק/ללא שכבת טקסט
      return NextResponse.json({ ok: true, id: "", status: "needs_ocr", pageCount });
    }

    // שמירה ל-DB (דריסה/יצירה לפי userId)
    const saved = await prisma.resume.upsert({
      where: { userId: user.id },
      update: { text, skills: [], yearsExp: null },
      create: { userId: user.id, text, skills: [], yearsExp: null },
      select: { id: true },
    });

    return NextResponse.json({
      ok: true,
      resumeId: saved.id,
      pageCount,
      chars: text.length,
    });
  } catch (e: any) {
    console.error("[upload] UNHANDLED:", e);
    return bad("UNKNOWN", 500, { message: e?.message });
  }
});
