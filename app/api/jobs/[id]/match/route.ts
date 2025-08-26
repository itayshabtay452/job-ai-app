// app/api/jobs/[id]/match/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUser } from "@/lib/auth";
import { computeMatch } from "@/lib/match/engine";

export const runtime = "nodejs";

/** אובייקט אפשרי שמגיע מ-Resume.skills כשהאנליזה שמרה fields שונים */
type ResumeSkillsObj = {
  skills?: unknown;
  tools?: unknown;
  dbs?: unknown;
  [k: string]: unknown;
};

/** Type Guard: אמת שהערך הוא אובייקט (לא מערך) כדי שנוכל לגשת לשדות אופציונליים בבטחה */
function isResumeSkillsObj(val: unknown): val is ResumeSkillsObj {
  return !!val && typeof val === "object" && !Array.isArray(val);
}

/** סינון בטוח למערך מחרוזות */
function toStringArray(val: unknown): string[] {
  return Array.isArray(val) ? val.filter((x): x is string => typeof x === "string") : [];
}

/** חילוץ סקילז מהמופע הגמיש של Resume.skills (או מערך פשוט, או אובייקט עם שדות אופציונליים) */
function extractCandidateSkills(input: unknown): string[] {
  // מקרה 1: מערך פשוט ["React","TypeScript"]
  if (Array.isArray(input)) {
    return toStringArray(input);
  }
  // מקרה 2: אובייקט לא-מערך { skills?:[], tools?:[], dbs?:[] }
  if (isResumeSkillsObj(input)) {
    const base = toStringArray(input.skills);
    const tools = toStringArray(input.tools);
    const dbs = toStringArray(input.dbs);
    return [...base, ...tools, ...dbs];
  }
  // אחר — לא מזוהה
  return [];
}

/**
 * GET /api/jobs/[id]/match (מוגן עם withUser)
 * מחזיר: { ok, score, reasons, breakdown }
 * שגיאות: 404 / 422 (401 מטופל ע״י withUser)
 */
export async function GET(
  req: Request,
  ctx: { params: { id: string } }
) {
  const jobId = ctx.params.id;

  return withUser(async (_req, { user }) => {
    // 1) טוענים משרה
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        skillsRequired: true,
      },
    });
    if (!job) {
      return NextResponse.json({ ok: false, error: "JOB_NOT_FOUND" }, { status: 404 });
    }

    // 2) טוענים Resume לפי userId
    const resume = await prisma.resume.findUnique({
      where: { userId: user.id },
      select: { skills: true, yearsExp: true },
    });
    if (!resume) {
      return NextResponse.json({ ok: false, error: "NO_RESUME" }, { status: 422 });
    }

    // 3) חילוץ סקילז
    const candidateSkills = extractCandidateSkills(resume.skills);
    if (candidateSkills.length === 0) {
      return NextResponse.json(
        { ok: false, error: "NO_CANDIDATE_SKILLS" },
        { status: 422 }
      );
    }

    // 4) חישוב התאמה
    const result = computeMatch({
      candidateSkills,
      candidateYears: typeof resume.yearsExp === "number" ? resume.yearsExp : null,
      jobSkills: job.skillsRequired ?? [],
      jobLocation: job.location ?? null,
    });

    // 5) שמירה/עדכון Match (ללא @@unique בשלב זה)
    const existing = await prisma.match.findFirst({
      where: { userId: user.id, jobId: job.id },
      select: { id: true },
    });

    if (existing) {
      await prisma.match.update({
        where: { id: existing.id },
        data: { score: result.score, reasons: result.reasons },
      });
    } else {
      await prisma.match.create({
        data: { userId: user.id, jobId: job.id, score: result.score, reasons: result.reasons },
      });
    }

    // 6) תשובה
    return NextResponse.json({
      ok: true,
      score: result.score,
      reasons: result.reasons,
      breakdown: result.breakdown,
    });
  })(req);
}
