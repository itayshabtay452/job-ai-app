// app/api/jobs/[id]/cover-letter/route.ts
import { NextResponse } from "next/server";
import { withUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/jobs/:id/cover-letter
 * מחזיר טיוטה קיימת (אם יש) עבור המשתמש המחובר.
 * שגיאות: 401 (עם withUser), 404 (Job לא קיים)
 */
export async function GET(req: Request, ctx: { params: { id: string } }) {
    const jobId = ctx.params.id;

    return withUser(async (_req, { user }) => {
        // 1) ודא שהמשרה קיימת (מונע חשיפת מידע על jobId שגוי)
        const job = await prisma.job.findUnique({
            where: { id: jobId },
            select: { id: true },
        });
        if (!job) {
            return NextResponse.json({ ok: false, error: "JOB_NOT_FOUND" }, { status: 404 });
        }

        // 2) שלוף טיוטה אחרונה (אם יש). בשלב הזה לרוב יש רשומה אחת לכל user+job.
        const draft = await prisma.applicationDraft.findFirst({
            where: { userId: user.id, jobId: job.id }, // ← הקשחה מומלצת
            orderBy: { updatedAt: "desc" },
            select: { id: true, coverLetter: true, updatedAt: true },
        });
        // הערה: אם בעתיד תאפשר ריבוי טיוטות, אפשר להחזיר מערך. כרגע — רשומה אחרונה/יחידה.

        return NextResponse.json({
            ok: true,
            draft: draft
                ? { id: draft.id, coverLetter: draft.coverLetter, updatedAt: draft.updatedAt }
                : null,
        });
    })(req);
}
