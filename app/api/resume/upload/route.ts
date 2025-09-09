// C:\Users\itays\Desktop\33\job-ai-app\app\api\resume\upload\route.ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs"; // מוודא ריצה על Node (לא edge)

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "missing file" }, { status: 400 });
    }

    // בדיקות בסיסיות
    const filename = file.name || "resume.pdf";
    const size = file.size;
    if (size === 0) return NextResponse.json({ error: "empty file" }, { status: 400 });
    if (size > 5 * 1024 * 1024)
      return NextResponse.json({ error: "file too large (max 5MB)" }, { status: 400 });

    // בדיקת סיומת ותוכן בסיסית
    const lower = filename.toLowerCase();
    if (!lower.endsWith(".pdf"))
      return NextResponse.json({ error: "only PDF allowed" }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());

    // חתימת PDF בסיסית (%PDF בתחילת הקובץ)
    const header = buf.subarray(0, 4).toString("utf8");
    if (!header.startsWith("%PDF")) {
      return NextResponse.json({ error: "invalid pdf signature" }, { status: 400 });
    }

    // ✅ פרוד-פרנדלי: ננתח ונשמור ל-DB כאן (ללא tmp), כך שזה יעבוד גם ב-Vercel
    const { id: userId } = await requireUser();
    const { default: pdfParse } = await import("pdf-parse"); // ESM-ידידותי בפרוד
    const parsed = await pdfParse(buf);
    const text = (parsed.text || "").trim();
    const pageCount = parsed.numpages ?? 0;

    if (!text || text.length < 20) {
      // עדיין מחזירים תשובה רכה – ה-UI יכול להציע OCR
      return NextResponse.json({ ok: true, status: "needs_ocr", pageCount, bytes: size });
    }

   const resume = await prisma.resume.upsert({
      where: { userId },
      update: { text, skills: [], yearsExp: null },
      create: { userId, text, skills: [], yearsExp: null },
      select: { id: true },
    });

    // שומרים תאימות לאחור: מי שמסתמך על שדה id מה-Upload יקבל null (לא נדרש יותר),
    // ומי שמסתמך על parse אחרי upload – יקבל מידית DB מעודכן (ראה המסלול המעודכן של /parse).
    return NextResponse.json({
      ok: true,
      resumeId: resume.id,
      pageCount,
      bytes: size,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "upload error" }, { status: 500 });
  }
}
// #endregion
