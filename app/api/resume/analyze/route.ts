// app/api/resume/analyze/route.ts
import { NextResponse } from "next/server";
import { withUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import OpenAI from "openai";

export const runtime = "nodejs";

// JSON Schema לתשובת המודל
const ProfileSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    skills: { type: "array", items: { type: "string" } },
    tools:  { type: "array", items: { type: "string" } },
    dbs:    { type: "array", items: { type: "string" } },
    years:  { type: "number", minimum: 0 },
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

  // להביא את הטקסט ששמרנו בשלב 8
  const resume = await prisma.resume.findUnique({ where: { userId: user.id } });
  if (!resume?.text?.trim()) {
    return NextResponse.json({ error: "no resume text to analyze" }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // קריאה למודל עם יציאה מובנית לפי JSON Schema
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",            // דגם מהיר/חסכוני; אפשר לשנות לפי הצורך
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

  const content = completion.choices?.[0]?.message?.content ?? "{}";

  // ולידציה בסיסית
  let profile: any;
  try { profile = JSON.parse(content); }
  catch { return NextResponse.json({ error: "model did not return valid JSON" }, { status: 502 }); }

  if (
    !Array.isArray(profile.skills) ||
    !Array.isArray(profile.tools) ||
    !Array.isArray(profile.dbs) ||
    typeof profile.years !== "number" ||
    !Array.isArray(profile.highlights)
  ) {
    return NextResponse.json({ error: "profile validation failed" }, { status: 502 });
  }

  // שמירה: כל האובייקט בשדה Json 'skills' + עדכון yearsExp
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
