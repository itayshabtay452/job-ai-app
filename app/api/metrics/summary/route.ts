// app/api/metrics/summary/route.ts
import { NextResponse } from "next/server";
import { withUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

// ולידציית פרמטרים: days ∈ [1..365], ברירת מחדל 7
const QuerySchema = z.object({
  days: z.coerce.number().int().positive().max(365).default(7),
});

/**
 * GET /api/metrics/summary?days=7
 * מחזיר סיכום מדדים על בסיס AiUsage ו-UsageEvent עבור המשתמש המחובר.
 */
export async function GET(req: Request) {
  // ⤵️ שימוש בסגנון המקורי שלך: withUser(fn)(req)
  return withUser(async (_req: Request, { user }) => {
    // נחלץ את ה-query מה-Request הרגיל
    const url = new URL(_req.url);
    const queryObj = Object.fromEntries(url.searchParams);
    const { days } = QuerySchema.parse(queryObj);

    const now = new Date();
    const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // --- Aggregation על AiUsage ---
    const aiAgg = await prisma.aiUsage.aggregate({
      _count: { _all: true },
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        latencyMs: true,
        costUsd: true,
      },
      where: {
        userId: user.id,
        createdAt: { gte: from },
      },
    });

    // ממוצע latency (ב-ms) — אם אין קריאות, 0
    const aiCalls = aiAgg._count._all;
    const avgLatencyMs =
      aiCalls > 0 ? Math.round((aiAgg._sum.latencyMs ?? 0) / aiCalls) : 0;

    // עלות יכולה להיות Decimal|null → להמיר ל-number או null
    const totalCostUsd =
      aiAgg._sum.costUsd !== null && aiAgg._sum.costUsd !== undefined
        ? Number(aiAgg._sum.costUsd)
        : null;

    // --- אירועי מוצר (ספירת מכתבים) ---
    const [createdCount, regeneratedCount] = await Promise.all([
      prisma.usageEvent.count({
        where: {
          userId: user.id,
          type: "cover_letter_created",
          createdAt: { gte: from },
        },
      }),
      prisma.usageEvent.count({
        where: {
          userId: user.id,
          type: "cover_letter_regenerated",
          createdAt: { gte: from },
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      range: {
        days,
        from: from.toISOString(),
        to: now.toISOString(),
      },
      ai: {
        calls: aiCalls,
        promptTokens: aiAgg._sum.promptTokens ?? 0,
        completionTokens: aiAgg._sum.completionTokens ?? 0,
        totalTokens: aiAgg._sum.totalTokens ?? 0,
        avgLatencyMs,
        costUsd: totalCostUsd, // number | null
      },
      coverLetters: {
        created: createdCount,
        regenerated: regeneratedCount,
        total: createdCount + regeneratedCount,
      },
    });
  })(req);
}
