import { NextResponse } from "next/server";
import { withUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/** GET /api/metrics/summary?days=7 */
export async function GET(req: Request) {
  return withUser(async (_req, { user }) => {
    const url = new URL(_req.url);
    const daysRaw = Number(url.searchParams.get("days") ?? "7");
    const days = Number.isFinite(daysRaw) ? Math.min(30, Math.max(1, Math.trunc(daysRaw))) : 7;

    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

    // --- AI usage aggregate ---
    const aiAgg = await prisma.aiUsage.aggregate({
      where: { userId: user.id, createdAt: { gte: from, lte: to } },
      _count: true, // יחזיר מספר; אם אי פעם ישתנה – נגן גם על {_all}
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        costUsd: true,
      },
      _avg: { latencyMs: true },
    });

    // נרמל _count (תמיכה גם בצורה {_all})
    const calls =
      typeof aiAgg._count === "number"
        ? aiAgg._count
        : (aiAgg as any)?._count?._all ?? 0;

    const promptTokens = aiAgg._sum.promptTokens ?? 0;
    const completionTokens = aiAgg._sum.completionTokens ?? 0;
    const totalTokens = aiAgg._sum.totalTokens ?? 0;

    // latency ממוצע – אם אין נתונים ייתכן null
    const avgLatencyMs =
      aiAgg._avg.latencyMs == null ? 0 : Math.round(aiAgg._avg.latencyMs);

    // costUsd יכול להיות Decimal | number | null → נהפוך למספר או null
    const costUsd =
      aiAgg._sum.costUsd == null
        ? null
        : typeof aiAgg._sum.costUsd === "number"
        ? aiAgg._sum.costUsd
        : Number(aiAgg._sum.costUsd.toString());

    // --- Cover letter events ---
    const [created, regenerated] = await Promise.all([
      prisma.usageEvent.count({
        where: {
          userId: user.id,
          type: "cover_letter_created",
          createdAt: { gte: from, lte: to },
        },
      }),
      prisma.usageEvent.count({
        where: {
          userId: user.id,
          type: "cover_letter_regenerated",
          createdAt: { gte: from, lte: to },
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      range: {
        days,
        from: from.toISOString(),
        to: to.toISOString(),
      },
      ai: {
        calls,
        promptTokens,
        completionTokens,
        totalTokens,
        avgLatencyMs,
        costUsd,
      },
      coverLetters: {
        created,
        regenerated,
      },
    });
  })(req);
}
