// app/api/jobs/list/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/jobs/list?q=&location=&skill=&page=&pageSize=
 * מחזיר רשימת משרות עם פילטרים בסיסיים ועמוד/גודל עמוד.
 */
export async function GET(req: Request) {
  // 1) שליפה בטוחה של פרמטרים מה-URL
  const { searchParams } = new URL(req.url);
  const q        = (searchParams.get("q") || "").trim();
  const location = (searchParams.get("location") || "").trim();
  const skill    = (searchParams.get("skill") || "").trim().toLowerCase();

  // 2) עמודים עם גבולות: page>=1, 1<=pageSize<=50
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSizeRaw = parseInt(searchParams.get("pageSize") || "20", 10);
  const pageSize = Math.min(50, Math.max(1, isNaN(pageSizeRaw) ? 20 : pageSizeRaw));

  // 3) בניית where דינמי
  const where: any = {};

  if (q) {
    where.OR = [
      { title:       { contains: q, mode: "insensitive" } },
      { company:     { contains: q, mode: "insensitive" } },
      { location:    { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  if (location) {
    // אם יש גם q וגם location, התנאים יצברו (AND)
    where.location = { contains: location, mode: "insensitive" };
  }

  if (skill) {
    // skillsRequired הוא String[] → אפשר להשתמש ב-has
    where.skillsRequired = { has: skill };
  }

  // 4) שתי פניות במקביל: count + findMany (עם דפדוף)
  const [total, items] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      orderBy: { createdAt: "desc" },              // יש לנו @@index([createdAt]) בסכמה
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        skillsRequired: true,
        url: true,
        createdAt: true,
      },
    }),
  ]);

  // 5) החזרת תשובה מסודרת ללקוח
  return NextResponse.json({
    ok: true,
    total,
    page,
    pageSize,
    items,
  });
}
