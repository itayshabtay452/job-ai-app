// app/api/jobs/[id]/cover-letter/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUser } from "@/lib/auth";
import { rateLimitTouch, rateLimitHeaders } from "@/lib/security/rateLimit";
import { PostCoverLetterSchema, PutCoverLetterSchema, wordCount } from "@/lib/validation/coverLetter";
import { buildCoverLetterPrompt, extractResumeProfile } from "@/lib/cover-letter/prompt";
import OpenAI from "openai";
// [Stage15] מדדים
import { logAiUsage, logEvent } from "@/lib/metrics";

export const runtime = "nodejs";

/** עוזר קטן לקריאת JSON בבטחה */
async function safeJson<T = unknown>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

/** בחירה אחידה של שדות Draft לתשובה */
function shapeDraft(d: { id: string; coverLetter: string; updatedAt: Date }) {
  return { id: d.id, coverLetter: d.coverLetter, updatedAt: d.updatedAt.toISOString() };
}

/** GET /api/jobs/[id]/cover-letter — שליפת טיוטה (אם קיימת) */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const jobId = id;

  return withUser(async (_req, { user }) => {
    // RL: 30 לדקה
    const LIMIT = 30;
    const rl = rateLimitTouch({ key: `cover:get:${user.id}`, limit: LIMIT, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMITED" },
        { status: 429, headers: rateLimitHeaders(rl, LIMIT) }
      );
    }

    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true } });
    if (!job) {
      return NextResponse.json(
        { ok: false, error: "JOB_NOT_FOUND" },
        { status: 404, headers: rateLimitHeaders(rl, LIMIT) }
      );
    }

    const draft = await prisma.applicationDraft.findFirst({
      where: { userId: user.id, jobId: job.id },
      select: { id: true, coverLetter: true, updatedAt: true },
    });

    return NextResponse.json(
      { ok: true, draft: draft ? shapeDraft(draft) : null },
      { headers: rateLimitHeaders(rl, LIMIT) }
    );
  })(req);
}

/** POST /api/jobs/[id]/cover-letter — יצירה עם AI ושמירה כטיוטה */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const jobId = id;

  return withUser(async (_req, { user }) => {
    // RL: 5 לכל 10 דקות
    const LIMIT = 5;
    const WINDOW = 600_000;
    const rl = rateLimitTouch({ key: `cover:post:${user.id}`, limit: LIMIT, windowMs: WINDOW });
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMITED" },
        { status: 429, headers: rateLimitHeaders(rl, LIMIT) }
      );
    }

    // ולידציה של גוף הבקשה
    const body = await safeJson(_req);
    const parsed = PostCoverLetterSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "ZOD_INVALID_BODY", issues: parsed.error.issues },
        { status: 400, headers: rateLimitHeaders(rl, LIMIT) }
      );
    }
    const maxWords = parsed.data.maxWords ?? 220;

    // נתונים
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, title: true, company: true, location: true, description: true, skillsRequired: true },
    });
    if (!job) {
      return NextResponse.json(
        { ok: false, error: "JOB_NOT_FOUND" },
        { status: 404, headers: rateLimitHeaders(rl, LIMIT) }
      );
    }

    const resume = await prisma.resume.findUnique({
      where: { userId: user.id },
      select: { skills: true, text: true, yearsExp: true },
    });
    if (!resume) {
      return NextResponse.json(
        { ok: false, error: "NO_RESUME" },
        { status: 422, headers: rateLimitHeaders(rl, LIMIT) }
      );
    }

    // אחרי שהבאנו את resume ו- job:
    const profile = extractResumeProfile(resume.skills);

    // נבנה את האובייקט המדויק ש-ResumeLike מצפה לו
    const resumeLike = {
      text: resume.text,
      yearsExp: typeof resume.yearsExp === "number" ? resume.yearsExp : undefined, // לא null
      profile, // { skills[], tools[], dbs[], highlights? }
    } as const;

    // ועכשיו בונים את הפרומפט עם טיפוסים תואמים
    const prompt = buildCoverLetterPrompt({
      job,          // השדות שבחרת ב-select מתאימים ל-JobLike
      resume: resumeLike,
      maxWords,
    });

    // OpenAI
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "MISSING_OPENAI_KEY" },
        { status: 500, headers: rateLimitHeaders(rl, LIMIT) }
      );
    }
    const openai = new OpenAI({ apiKey });

    // [Stage15] מדידת זמן סביב OpenAI (וגם לוג שגיאה אם נופל)
    const t0 = Date.now();
    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: prompt.messages,
        temperature: 0.3,
      });
    } catch (err: any) {
      const t1 = Date.now();
      // לוג כשל ב-AI (לא משנה התנהגות — נזרוק הלאה)
      await logAiUsage({
        userId: user.id,
        endpoint: "/api/jobs/[id]/cover-letter",
        method: "POST",
        model: "gpt-4o-mini",
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        latencyMs: t1 - t0,
        status: "error",
        error: err?.message ?? "OPENAI_ERROR",
      });
      throw err; // נשמר את ההתנהגות הקודמת (500)
    }
    const t1 = Date.now();

    // [Stage15] לוג שימוש תקין ב-AI (טוקנים/מודל/Latency)
    {
      const usage = completion.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      const model = completion.model ?? "gpt-4o-mini";
      await logAiUsage({
        userId: user.id,
        endpoint: "/api/jobs/[id]/cover-letter",
        method: "POST",
        model,
        promptTokens: usage.prompt_tokens ?? 0,
        completionTokens: usage.completion_tokens ?? 0,
        totalTokens: usage.total_tokens ?? 0,
        latencyMs: t1 - t0,
        status: "ok",
      });
    }

    const content = completion.choices?.[0]?.message?.content?.toString().trim() ?? "";
    if (!content) {
      return NextResponse.json(
        { ok: false, error: "EMPTY_COMPLETION" },
        { status: 500, headers: rateLimitHeaders(rl, LIMIT) }
      );
    }

    // בדיקת מגבלת מילים קשיחה
    if (wordCount(content) > maxWords) {
      return NextResponse.json(
        { ok: false, error: "OVER_WORD_LIMIT", maxWords },
        { status: 422, headers: rateLimitHeaders(rl, LIMIT) }
      );
    }

    // persist draft (ללא @@unique — update/create)
    const existing = await prisma.applicationDraft.findFirst({
      where: { userId: user.id, jobId: job.id },
      select: { id: true },
    });

    let saved;
    if (existing) {
      saved = await prisma.applicationDraft.update({
        where: { id: existing.id },
        data: { coverLetter: content },
        select: { id: true, coverLetter: true, updatedAt: true },
      });
    } else {
      saved = await prisma.applicationDraft.create({
        data: { userId: user.id, jobId: job.id, coverLetter: content },
        select: { id: true, coverLetter: true, updatedAt: true },
      });
    }

    // [Stage15] אירוע מוצר: יצירה ראשונית/רג'נרציה
    await logEvent({
      userId: user.id,
      type: existing ? "cover_letter_regenerated" : "cover_letter_created",
      refId: saved.id,
      meta: { jobId },
    });

    return NextResponse.json(
      { ok: true, draft: shapeDraft(saved), maxWords },
      { headers: rateLimitHeaders(rl, LIMIT) }
    );
  })(req);
}

/** PUT /api/jobs/[id]/cover-letter — עדכון ידני ושמירה כטיוטה */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const jobId = id;

  return withUser(async (_req, { user }) => {
    // RL: 20 לדקה
    const LIMIT = 20;
    const rl = rateLimitTouch({ key: `cover:put:${user.id}`, limit: LIMIT, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMITED" },
        { status: 429, headers: rateLimitHeaders(rl, LIMIT) }
      );
    }

    const body = await safeJson(_req);
    const parsed = PutCoverLetterSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "ZOD_INVALID_BODY", issues: parsed.error.issues },
        { status: 400, headers: rateLimitHeaders(rl, LIMIT) }
      );
    }

    const text = parsed.data.coverLetter.trim();
    const wc = wordCount(text);
    if (wc > 400) {
      return NextResponse.json(
        { ok: false, error: "OVER_WORD_LIMIT", maxWords: 400, words: wc },
        { status: 422, headers: rateLimitHeaders(rl, LIMIT) }
      );
    }

    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true } });
    if (!job) {
      return NextResponse.json(
        { ok: false, error: "JOB_NOT_FOUND" },
        { status: 404, headers: rateLimitHeaders(rl, LIMIT) }
      );
    }

    const existing = await prisma.applicationDraft.findFirst({
      where: { userId: user.id, jobId: job.id },
      select: { id: true },
    });

    let saved;
    if (existing) {
      saved = await prisma.applicationDraft.update({
        where: { id: existing.id },
        data: { coverLetter: text },
        select: { id: true, coverLetter: true, updatedAt: true },
      });
    } else {
      saved = await prisma.applicationDraft.create({
        data: { userId: user.id, jobId: job.id, coverLetter: text },
        select: { id: true, coverLetter: true, updatedAt: true },
      });
    }

    return NextResponse.json(
      { ok: true, draft: shapeDraft(saved) },
      { headers: rateLimitHeaders(rl, LIMIT) }
    );
  })(req);
}
