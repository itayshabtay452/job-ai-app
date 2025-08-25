// lib/jobs/normalize.ts
import { createHash } from "node:crypto";

/**
 * זהו המבנה האחיד שנשמור ב-DB (Prisma.Job).
 * חשוב: השדות כאן תואמים לשדות שבמודל Job אחרי המיגרציה.
 */
export type NormalizedJob = {
  source: string;          // מקור הפיד (למשל "mockA")
  externalId: string;      // מזהה ייחודי בתוך המקור (או hash שנחשב)
  title: string;           // כותרת התפקיד
  company: string;         // שם החברה
  location?: string | null;// מיקום טקסטואלי (עיר/Remote)
  description: string;     // תיאור התפקיד
  skillsRequired: string[];// מערך מחרוזות נקי ומנורמל
  url?: string | null;     // קישור למשרה
};

/**
 * יוצר מזהה דטרמיניסטי קצר (16 hex) כשאין externalId מהמקור.
 * למה sha256 וקיצור ל-16 תווים?
 * - דטרמיניסטי: אותה קומבינציה תניב תמיד את אותו מזהה.
 * - קצר: מספיק לייחודיות פנימית, ידידותי ללוגים.
 * - lowercasing ושילוב עם מפריד " | " מונעים הבדלי רישיות/רווחים.
 */
function hashId(...parts: (string | undefined | null)[]) {
  const s = parts.filter(Boolean).join("|").toLowerCase();
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

/**
 * נרמול סקיל בודד:
 * - trim → הסרת רווחים מיותרים
 * - toLowerCase → אחידות (react/React/REACT)
 * - החלפת ריבוי רווחים ברווח יחיד
 * הערה: לא מוחקים סימנים כמו "." או "-" כדי לשמר שמות כמו "node.js" / "next-js".
 */
function normSkill(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * דה-דופליקציה של מערך סקילז:
 * - מנרמל כל פריט
 * - מסנן ריקים
 * - שומר סדר הופעה ראשון (לקריאות אנושית)
 */
function dedupeSkills(arr: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of arr) {
    const k = normSkill(x);
    if (!k) continue;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}

/**
 * עוזר קטן: הפיכת ערך "skills" גמיש (מערך/מחרוזת/שדה בשם אחר) לרשימת מחרוזות.
 * תומך בשמות שונים ממקורות שונים: skills / tags / tech_stack.
 * אם קיבלנו מחרוזת: מפצלים לפי פסיקים/נקודה-פסיק/שורה חדשה.
 */
function extractSkills(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw.skills)) return raw.skills;
  if (Array.isArray(raw.tags)) return raw.tags;
  if (Array.isArray(raw.tech_stack)) return raw.tech_stack;

  if (typeof raw.skills === "string") {
    return raw.skills.split(/[,;\n]/g);
  }
  if (typeof raw.tech_stack === "string") {
    return raw.tech_stack.split(/[,;\n]/g);
  }
  if (typeof raw.tags === "string") {
    return raw.tags.split(/[,;\n]/g);
  }
  return [];
}

/**
 * פונקציה שמקבלת אייטם גולמי מהפיד ומחזירה NormalizedJob
 * או null אם חסרים שדות ליבה (title/company).
 */
export function normalizeJob(raw: any): NormalizedJob | null {
  // 1) מקור
  const source = (raw?._source || raw?.source || "unknown").toString();

  // 2) שדות ליבה לכותרת/חברה — מחייבים אותם; אם חסר → מחזירים null
  const title = (raw?.title || raw?.job_title || "").toString().trim();
  const company = (raw?.company || raw?.company_name || "").toString().trim();
  if (!title || !company) return null;

  // 3) מיקום: מאחדים בין city/location; אופציונלי
  const location = (raw?.location || raw?.city || null) as string | null;

  // 4) תיאור: אם ריק, נ fallback לכותרת (עדיף לא להשאיר ריק)
  const description =
    ((raw?.description || raw?.desc || "") as string).toString().trim() || title;

  // 5) URL אופציונלי
  const url = (raw?.url || raw?.apply_url || null) as string | null;

  // 6) Skills: איסוף → נרמול → דה-דופליקציה
  const skillsRaw = extractSkills(raw);
  const skillsRequired = dedupeSkills(skillsRaw);

  // 7) externalId: אם קיים במקור — מעולה; אם לא — מחושבים hash דטרמיניסטי
  const externalIdRaw = (raw?.externalId || raw?.id || raw?.uuid || null) as string | null;
  const externalId = externalIdRaw ?? hashId(source, title, company, location || "");

  // 8) מחזירים מבנה אחיד ומוכן ל-DB
  return { source, externalId, title, company, location, description, skillsRequired, url };
}

/**
 * נורמליזציה לקולקציה של אייטמים: מדלגים על nulls (אייטמים פגומים).
 */
export function normalizeFeed(items: any[]): NormalizedJob[] {
  const out: NormalizedJob[] = [];
  for (const item of items) {
    const j = normalizeJob(item);
    if (j) out.push(j);
  }
  return out;
}
