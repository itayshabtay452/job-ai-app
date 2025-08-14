// app/api/resume/parse/route.ts
import { NextResponse } from "next/server";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getServerSession, type NextAuthOptions } from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

export const runtime = "nodejs"; // חשוב: ריצה על Node, לא Edge

// אותן הגדרות כמו ב-[...nextauth] כדי ש-getServerSession יעבוד
const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  session: { strategy: "database" },
};

export async function POST(req: Request) {
  // ולידציה של ה־id
  const { id } = await req.json().catch(() => ({}));
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  // אימות משתמש
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 401 });

  const filePath = join(tmpdir(), `resume-${id}.pdf`);

  try {
    const buf = await readFile(filePath);

    // ⬇⬇⬇ ייבוא דינמי של המימוש הפנימי – עוקף index.js והדיבאג הבעייתי
    const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js");

    const parsed = await pdfParse(buf);
    const text = (parsed.text || "").trim();
    const pageCount = parsed.numpages ?? 0;

    // אין שכבת טקסט? נסמן כ-needs_ocr ולא ניצור רשומה זמנית ריקה
    if (!text || text.length < 20) {
      return NextResponse.json({ ok: true, id, status: "needs_ocr", pageCount });
    }

    // שמירה/עדכון של ה-Resume עבור המשתמש (כדי לא ליצור כפילויות)
    const resume = await prisma.resume.upsert({
      where: { userId: user.id },
      update: {
        text,
        skills: [],     // ימולא בשלב 9
        yearsExp: null, // אופציונלי
      },
      create: {
        userId: user.id,
        text,
        skills: [],
        yearsExp: null,
      },
      select: { id: true },
    });

    return NextResponse.json({
      ok: true,
      resumeId: resume.id,
      pageCount,
      chars: text.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "parse error" }, { status: 500 });
  } finally {
    // ניקוי best-effort של הקובץ הזמני – גם אם היו שגיאות
    await unlink(filePath).catch(() => {});
  }
}
