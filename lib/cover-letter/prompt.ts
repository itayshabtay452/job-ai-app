// lib/cover-letter/prompt.ts

/** תיאור מינימלי של משרה שנדרש לפרומפט */
export type JobLike = {
  title: string;
  company: string;
  location?: string | null;
  description: string;
  skillsRequired: string[];
};

/** תיאור מינימלי של פרופיל רזומה שנדרש לפרומפט */
export type ResumeLike = {
  text?: string;
  skills?: unknown;          // יכול להיות array או object עם { skills, tools, dbs, highlights }
  yearsExp?: number | null;
};

/** תוצאה מבנית של הפרופיל לאחר חילוץ */
export type ResumeProfile = {
  skills: string[];
  tools: string[];
  dbs: string[];
  highlights: string[];
};

/** כלי עזר: ממיר קלט לא ידוע לרשימת מחרוזות חוקית */
function toStringArray(val: unknown): string[] {
  return Array.isArray(val) ? val.filter((x): x is string => typeof x === "string") : [];
}

/** חילוץ פרופיל מהמופע הגמיש של Resume.skills */
export function extractResumeProfile(skillsJson: unknown): ResumeProfile {
  const isObj = !!skillsJson && typeof skillsJson === "object" && !Array.isArray(skillsJson);
  if (!isObj) {
    // אם זה מערך פשוט של מחרוזות — נכניס אותו ל-skills ונשאיר השאר ריקים
    return { skills: toStringArray(skillsJson), tools: [], dbs: [], highlights: [] };
  }
  const o = skillsJson as Record<string, unknown>;
  return {
    skills: toStringArray(o.skills),
    tools: toStringArray(o.tools),
    dbs: toStringArray(o.dbs),
    highlights: toStringArray((o as any).highlights), // אופציונלי מה-Analyze
  };
}

/** זיהוי שפה בסיסי: אם יש אותיות עבריות בתיאור המשרה → עברית, אחרת אנגלית */
export function detectLanguageFromJob(job: JobLike): "he" | "en" {
  const heRegex = /[\u0590-\u05FF]/; // טווח Unicode לעברית
  const text = `${job.title} ${job.company} ${job.location ?? ""} ${job.description}`;
  return heRegex.test(text) ? "he" : "en";
}

/** טיפוס תשובת בנאי הפרומפט */
export type BuiltCoverPrompt = {
  messages: Array<{ role: "system" | "user"; content: string }>;
  language: "he" | "en";
  maxWords: number;
};

/**
 * בניית פרומפט אחיד לכתיבת Cover Letter:
 * - טון ענייני וקצר
 * - מגבלת מילים קשיחה (80..400, ברירת מחדל 220)
 * - שילוב סקילז/היילייטס אמיתיים בלבד (ללא המצאות)
 */
export function buildCoverLetterPrompt(opts: {
  job: JobLike;
  resume: ResumeLike;
  maxWords?: number;
  language?: "he" | "en";
}): BuiltCoverPrompt {
  const { job } = opts;

  // מגבלת מילים בטווח סביר
  const maxWords = Math.max(80, Math.min(opts.maxWords ?? 220, 400));

  // זיהוי/בחירת שפה
  const lang = opts.language ?? detectLanguageFromJob(job);

  // חילוץ פרופיל
  const profile = extractResumeProfile(opts.resume.skills);

  // איחוד וייחוד של skills/tools/dbs
  const joined = [...profile.skills, ...profile.tools, ...profile.dbs];
  const uniqueSkills = Array.from(
    new Set(
      joined
        .map(s => (s ?? "").toString().trim())
        .filter(Boolean)
    )
  );

  // קיצור רשימות למניעת "רעש"
  const highlights = (profile.highlights ?? []).slice(0, 4);
  const jobSkills = (job.skillsRequired ?? []).slice(0, 8);

  // הנחיית מערכת (System) — טון וכללי כתיבה
  const sys = lang === "he"
    ? `אתה עוזר כתיבה תמציתי ומקצועי. המשימה: לכתוב מכתב פנייה קצר ומותאם אישית למשרה.
הימנע מקלישאות והגזמות; היצמד לעובדות ולדוגמאות קונקרטיות (רצוי עם מדדים).
הטון: מקצועי, שקול, בטוח אך לא מכירתי.`
    : `You are a concise, professional writing assistant. Task: write a short, tailored cover letter for a job.
Avoid clichés and exaggeration; stick to facts and concrete examples (ideally with metrics).
Tone: professional, measured, confident but not salesy.`;

  // הנחיית משתמש (User) — פרטי המשרה והפרופיל + הוראות קונקרטיות
  const user = lang === "he"
    ? `משרה:
- תפקיד: ${job.title}
- חברה: ${job.company}${job.location ? ` (${job.location})` : ""}
- תיאור: ${job.description.slice(0, 2000)}

פרופיל מועמד (מתוך קו"ח):
- מיומנויות/כלים/DBs: ${uniqueSkills.join(", ") || "—"}
- Highlights: ${highlights.join(" | ") || "—"}
- שנות ניסיון (אם קיימות): ${opts.resume.yearsExp ?? "—"}

הוראות:
- כתוב בעברית, עד ${maxWords} מילים (מגבלה קשיחה).
- פסקת פתיחה קצרה, 1–2 פסקאות גוף ממוקדות, וסיום מנומס.
- שלב 2–3 סקילז רלוונטיים מהמשרה: ${jobSkills.join(", ") || "—"}.
- אם יש Highlight מתאים — שלב אותו במשפט אחד.
- הימנע מתבניות כלליות (“אני מועמד מצוין”, “תמיד חלמתי” וכו’).
- אל תמציא פרטים שלא ניתנו.`
    : `Job:
- Title: ${job.title}
- Company: ${job.company}${job.location ? ` (${job.location})` : ""}
- Description: ${job.description.slice(0, 2000)}

Candidate profile (from resume):
- Skills/Tools/DBs: ${uniqueSkills.join(", ") || "—"}
- Highlights: ${highlights.join(" | ") || "—"}
- Years of experience (if any): ${opts.resume.yearsExp ?? "—"}

Instructions:
- Write in English, up to ${maxWords} words (strict limit).
- Brief opening, 1–2 focused body paragraphs, polite closing.
- Weave in 2–3 job-relevant skills: ${jobSkills.join(", ") || "—"}.
- If a matching highlight exists — mention succinctly (one sentence).
- Avoid generic claims or fluff.
- Do not invent facts.`;

  return {
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    language: lang,
    maxWords,
  };
}

/* TODO(v12.x):
 * - תמיכה בהעדפת שפה ידנית מה-UI (עברית/אנגלית).
 * - תמיכה ב"טון" (ענייני/חם/פורמלי) כפרמטר.
 * - השלמת prompt guardrails (מניעת PII/בדיקות מילות מפתח).
 */
