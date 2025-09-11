import { NextResponse } from "next/server";
import { withUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import OpenAI from "openai";
import { logAiUsage } from "@/lib/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// JSON Schema לתשובת המודל
const ProfileSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    skills: { type: "array", items: { type: "string" } },
    tools: { type: "array", items: { type: "string" } },
    dbs: { type: "array", items: { type: "string" } },
    years: { type: "number", minimum: 0 },
    highlights: { type: "array", items: { type: "string" } },
  },
  required: ["skills", "tools", "dbs", "years", "highlights"],
} as const;

const SYSTEM_PROMPT = `
You are an ATS assistant. Extract a structured candidate profile from the given resume text.
Return ONLY JSON that conforms EXACTLY to the provided JSON Schema (no prose).
Guidelines:
- skills: primary languages/frameworks/libs (lowercase, deduplicate).
- tools: dev tools/services (e.g., git, docker, postman, firebase, aws, vite).
- dbs: databases (e.g., postgres, mysql, mongodb, firestore).
- years: total hands-on experience in years (may be fractional).
- highlights: 4-8 short bullets (achievements/responsibilities).
`;

export const POST = withUser(async (_req, { user }) => {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });
  }

  const resume = await prisma.resume.findUnique({ where: { userId: user.id } });
  if (!resume?.text?.trim()) {
    return NextResponse.json({ error: "no resume text to analyze" }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const t0 = Date.now();
  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: resume.text },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "CandidateProfile", schema: ProfileSchema, strict: true },
      },
    });
  } catch (err: any) {
    const t1 = Date.now();
    await logAiUsage({
      userId: user.id,
      endpoint: "/api/resume/analyze",
      method: "POST",
      model: "gpt-4o-mini",
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      latencyMs: t1 - t0,
      status: "error",
      error: err?.message ?? "OPENAI_ERROR",
    });
    throw err;
  }
  const t1 = Date.now();

  {
    const usage = completion.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    const model = completion.model ?? "gpt-4o-mini";
    await logAiUsage({
      userId: user.id,
      endpoint: "/api/resume/analyze",
      method: "POST",
      model,
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      totalTokens: usage.total_tokens ?? 0,
      latencyMs: t1 - t0,
      status: "ok",
    });
  }

  const content = completion.choices?.[0]?.message?.content ?? "{}";

  let profile: any;
  try {
    profile = JSON.parse(content);
  } catch {
    return NextResponse.json({ error: "model did not return valid JSON" }, { status: 502 });
  }

  if (
    !Array.isArray(profile.skills) ||
    !Array.isArray(profile.tools) ||
    !Array.isArray(profile.dbs) ||
    typeof profile.years !== "number" ||
    !Array.isArray(profile.highlights)
  ) {
    return NextResponse.json({ error: "profile validation failed" }, { status: 502 });
  }

  const updated = await prisma.resume.update({
    where: { userId: user.id },
    data: {
      skills: profile,
      yearsExp: Math.max(0, Math.round(profile.years ?? 0)),
    },
    select: { id: true, yearsExp: true, skills: true },
  });

  return NextResponse.json({
    ok: true,
    resumeId: updated.id,
    profile: updated.skills,
    yearsExp: updated.yearsExp,
  });
});
