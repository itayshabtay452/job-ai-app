// lib/match/engine.ts

export type ComputeMatchInput = {
  candidateSkills: string[];      // סקילז מהמועמד (מופקים מה-Resume)
  candidateYears?: number | null; // TODO(v1.1): שקלול ניסיון
  jobSkills: string[];            // דרישות הסקילז מהמשרה
  jobLocation?: string | null;    // TODO(v1.1): שקלול מיקום
};

export type ComputeMatchOutput = {
  score: number; // 0..100
  reasons: string[];
  breakdown: {
    matched: string[];   // מהדרישות שהמועמד מכסה
    missing: string[];   // דרישות שחסרות למועמד
    extra: string[];     // סקילז שיש למועמד ואינם נדרשים
    coverage: number | null; // 0..1; null כשאין דרישות
  };
};

/** נירמול בסיסי: lowercase + trim + dedupe; מסנן ערכים לא-מחרוזת/ריקים */
function normalize(skills: string[] | undefined | null): string[] {
  if (!skills || !Array.isArray(skills)) return [];
  const cleaned = skills
    .map(s => (typeof s === "string" ? s.trim().toLowerCase() : ""))
    .filter(Boolean);
  return Array.from(new Set(cleaned));
}

/**
 * computeMatch (V1)
 * - אם אין דרישות → score=50
 * - אם אין סקילז למועמד → score=0
 * - אחרת: score = |C∩J| / |J| * 100 (מעוגל)
 */
export function computeMatch(input: ComputeMatchInput): ComputeMatchOutput {
  const job = normalize(input.jobSkills);
  const cand = normalize(input.candidateSkills);

  // אין דרישות — ציון ניטרלי
  if (job.length === 0) {
    return {
      score: 50,
      reasons: ["למשרה אין דרישות סקילז מוצהרות (ברירת מחדל: 50)."],
      breakdown: { matched: [], missing: [], extra: cand, coverage: null },
    };
  }

  // אין סקילז למועמד — ציון 0
  if (cand.length === 0) {
    return {
      score: 0,
      reasons: ["לפרופיל המועמד אין סקילז מזוהים (יש להריץ Analyze/להשלים קורות חיים)."],
      breakdown: { matched: [], missing: job, extra: [], coverage: 0 },
    };
  }

  // יצירת סטים ליעילות
  const candSet = new Set(cand);
  const jobSet = new Set(job);

  // חיתוך, חסרים ותוספות
  const matched = job.filter(s => candSet.has(s));
  const missing = job.filter(s => !candSet.has(s));
  const extra = cand.filter(s => !jobSet.has(s));

  // כיסוי וציונים
  const coverage = matched.length / job.length; // [0..1]
  const score = Math.round(coverage * 100);

  // ניסוח סיבות קצרות וברורות
  const reasons: string[] = [];
  if (matched.length) reasons.push(`התאמה: ${matched.join(", ")}`);
  if (missing.length) reasons.push(`חסרים: ${missing.join(", ")}`);
  if (extra.length) reasons.push(`תוספות שאינן נדרשות: ${extra.join(", ")}`);

  return {
    score,
    reasons,
    breakdown: { matched, missing, extra, coverage },
  };
}

/* TODO(v1.1):
 * - הוספת משקולות, ניסיון, מיקום, מילים נרדפות ו-levenshtein.
 */
