// app/api/jobs/list/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { JobsListQuerySchema } from "@/lib/validation/jobs";

export const runtime = "nodejs";

/**
 * GET /api/jobs/list?q&location&skill&page&pageSize
 * ציבורי לקריאה; כעת עם Zod לולידציה של הפרמטרים.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    // הפיכת URLSearchParams ל-Object רגיל ואז safeParse
    const input = Object.fromEntries(url.searchParams.entries());
    const parsed = JobsListQuerySchema.safeParse(input);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "ZOD_INVALID_QUERY", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { q, location, skill, page, pageSize } = parsed.data;

    // where דינמי לפי פרמטרים
    const AND: any[] = [];
    if (q && q.length > 0) {
      AND.push({
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { company: { contains: q, mode: "insensitive" } },
          { location: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      });
    }
    if (location && location.length > 0) {
      AND.push({ location: { contains: location, mode: "insensitive" } });
    }
    if (skill && skill.length > 0) {
      AND.push({ skillsRequired: { has: skill } }); // מאחר והסקילז נשמרו lowercase
    }

    const where = AND.length ? { AND } : {};

    const total = await prisma.job.count({ where });
    const items = await prisma.job.findMany({
      where,
      orderBy: { createdAt: "desc" },
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
    });

    return NextResponse.json({
      ok: true,
      total,
      page,
      pageSize,
      items,
    });
  } catch (e: any) {
    // ניזהר לא לדלוף פרטים
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
