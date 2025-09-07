import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUser } from "@/lib/auth";
import { computeMatch } from "@/lib/match/engine";
import { rateLimitTouch, rateLimitHeaders } from "@/lib/security/rateLimit";

export const runtime = "nodejs";

/** אובייקט אפשרי שמגיע מ-Resume.skills כשהאנליזה שמרה fields שונים */
type ResumeSkillsObj = {
  skills?: unknown;
  tools?: unknown;
  dbs?: unknown;
  [k: string]: unknown;
};
function isResumeSkillsObj(val: unknown): val is ResumeSkillsObj {
  return !!val && typeof val === "object" && !Array.isArray(val);
}
function toStringArray(val: unknown): string[] {
  return Array.isArray(val) ? val.filter((x): x is string => typeof x === "string") : [];
}
function extractCandidateSkills(input: unknown): string[] {
  if (Array.isArray(input)) return toStringArray(input);
  if (isResumeSkillsObj(input)) {
    const base = toStringArray(input.skills);
    const tools = toStringArray(input.tools);
    const dbs = toStringArray(input.dbs);
    return [...base, ...tools, ...dbs];
  }
  return [];
}

/**
 * GET /api/jobs/[id]/match
 * Rate limit: 20 בקשות לדקה לכל משתמש (לנתיב זה).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params;

  return withUser(async (_req, { user }) => {
    // --- RATE LIMIT ---
    const LIMIT = 20;
    const WINDOW = 60_000; // 1 דקה
    const rl = rateLimitTouch({ key: `match:${user.id}`, limit: LIMIT, windowMs: WINDOW });
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMITED" },
        { status: 429, headers: rateLimitHeaders(rl, LIMIT) }
      );
    }

    // 1) Job
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, title: true, company: true, location: true, skillsRequired: true },
    });
    if (!job) {
      return NextResponse.json({ ok: false, error: "JOB_NOT_FOUND" }, { status: 404, headers: rateLimitHeaders(rl, LIMIT) });
    }

    // 2) Resume
    const resume = await prisma.resume.findUnique({
      where: { userId: user.id },
      select: { skills: true, yearsExp: true },
    });
    if (!resume) {
      return NextResponse.json({ ok: false, error: "NO_RESUME" }, { status: 422, headers: rateLimitHeaders(rl, LIMIT) });
    }

    // 3) Skills
    const candidateSkills = extractCandidateSkills(resume.skills);
    if (candidateSkills.length === 0) {
      return NextResponse.json({ ok: false, error: "NO_CANDIDATE_SKILLS" }, { status: 422, headers: rateLimitHeaders(rl, LIMIT) });
    }

    // 4) Compute
    const result = computeMatch({
      candidateSkills,
      candidateYears: typeof resume.yearsExp === "number" ? resume.yearsExp : null,
      jobSkills: job.skillsRequired ?? [],
      jobLocation: job.location ?? null,
    });

    // 5) Persist Match
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

    // 6) Response
    return NextResponse.json(
      { ok: true, score: result.score, reasons: result.reasons, breakdown: result.breakdown },
      { headers: rateLimitHeaders(rl, LIMIT) }
    );
  })(req);
}
