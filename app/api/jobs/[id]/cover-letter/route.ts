// app/api/jobs/[id]/cover-letter/route.ts
import { NextResponse } from "next/server";
import { withUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import OpenAI from "openai";
import {
  buildCoverLetterPrompt,
  detectLanguageFromJob,
} from "@/lib/cover-letter/prompt";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// === עזר משותף ===
function countWords(s: string): number {
  return (s ?? "").trim().split(/\s+/).filter(Boolean).length;
}

async function getJobOr404(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      title: true,
      company: true,
      location: true,
      description: true,
      skillsRequired: true,
    },
  });
  return job; // null אם לא קיים
}

async function getResumeOrNull(userId: string) {
  return prisma.resume.findUnique({
    where: { userId },
    select: { text: true, skills: true, yearsExp: true },
  });
}

// === GET (מהצעד הקודם): שליפת טיוטה קיימת ===
export async function GET(req: Request, ctx: { params: { id: string } }) {
  const jobId = ctx.params.id;

  return withUser(async (_req, { user }) => {
    const job = await getJobOr404(jobId);
    if (!job) {
      return NextResponse.json({ ok: false, error: "JOB_NOT_FOUND" }, { status: 404 });
    }

    const draft = await prisma.applicationDraft.findFirst({
      where: { userId: user.id, jobId: job.id }, // הקשחת בעלות למשתמש
      orderBy: { updatedAt: "desc" },
      select: { id: true, coverLetter: true, updatedAt: true },
    });

    return NextResponse.json({
      ok: true,
      draft: draft ? { id: draft.id, coverLetter: draft.coverLetter, updatedAt: draft.updatedAt } : null,
    });
  })(req);
}

// === POST: יצירה עם AI ושמירת טיוטה ===
export async function POST(req: Request, ctx: { params: { id: string } }) {
  const jobId = ctx.params.id;

  return withUser(async (_req, { user }) => {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ ok: false, error: "MISSING_OPENAI_KEY" }, { status: 500 });
    }

    // 1) וידוא משרה
    const job = await getJobOr404(jobId);
    if (!job) {
      return NextResponse.json({ ok: false, error: "JOB_NOT_FOUND" }, { status: 404 });
    }

    // 2) וידוא Resume
    const resume = await getResumeOrNull(user.id);
    if (!resume) {
      return NextResponse.json({ ok: false, error: "NO_RESUME" }, { status: 422 });
    }

    // 3) קריאת גוף (maxWords אופציונלי)
    let maxWords = 220;
    try {
      const body = await req.json().catch(() => ({}));
      if (typeof body?.maxWords === "number" && body.maxWords > 50 && body.maxWords <= 400) {
        maxWords = Math.floor(body.maxWords);
      }
    } catch {
      /* ignore */
    }

    // 4) בניית פרומפט
    const prompt = buildCoverLetterPrompt({
      job,
      resume: { text: resume.text, skills: resume.skills, yearsExp: resume.yearsExp ?? null },
      maxWords,
      language: detectLanguageFromJob(job),
    });

    // 5) קריאה ל-OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // בחר דגם זול/זריז. אפשר לשנות לפי הצורך.
      messages: prompt.messages,
      temperature: 0.5,
    });

    const content = completion.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) {
      return NextResponse.json({ ok: false, error: "EMPTY_COMPLETION" }, { status: 500 });
    }

    // 6) בדיקת מגבלת מילים
    if (countWords(content) > prompt.maxWords) {
      return NextResponse.json({ ok: false, error: "OVER_WORD_LIMIT" }, { status: 422 });
    }

    // 7) Persist: עדכון/יצירה לפי (userId, jobId)
    const existing = await prisma.applicationDraft.findFirst({
      where: { userId: user.id, jobId: job.id },
      select: { id: true },
    });

    let draftId: string;
    if (existing) {
      const updated = await prisma.applicationDraft.update({
        where: { id: existing.id },
        data: { coverLetter: content },
        select: { id: true },
      });
      draftId = updated.id;
    } else {
      const created = await prisma.applicationDraft.create({
        data: { userId: user.id, jobId: job.id, coverLetter: content },
        select: { id: true },
      });
      draftId = created.id;
    }

    // 8) תשובה
    return NextResponse.json({
      ok: true,
      draft: { id: draftId, coverLetter: content, maxWords: prompt.maxWords },
    });
  })(req);
}
