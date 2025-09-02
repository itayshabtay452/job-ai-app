// lib/metrics.ts
// Stage 15 — לוגים ומדדים בסיסיים: עלות משוערת, טוקנים, Latency, ואירועי מוצר.
// הקובץ בטוח לשימוש בכל ראוט (Node runtime). שגיאות בלוגינג לא מפילות את הראוט.

import { prisma } from "@/lib/db";

/** מחירים ל-1K טוקנים בדולר: input (prompt) / output (completion) */
type PricePer1K = { input: number; output: number };
type PriceMap = Record<string, PricePer1K>;

/**
 * טוען מפת מחירים מ־ENV.
 * דוגמה ל־ENV:
 * OPENAI_PRICE_PER_1K_JSON='{"gpt-4o-mini":{"input":0.15,"output":0.60},"gpt-4o":{"input":2.50,"output":10.00}}'
 *
 * טיפ: השתמש במפתחות כלליים (למשל "gpt-4o-mini") — אנחנו נתאים גם לגרסאות מודל שמתחילות באותו מפתח.
 */
function loadPriceMap(): PriceMap | null {
  const raw = process.env.OPENAI_PRICE_PER_1K_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PriceMap;
    // ולידציה מינימלית
    for (const [k, v] of Object.entries(parsed)) {
      if (
        typeof k !== "string" ||
        !v ||
        typeof v.input !== "number" ||
        typeof v.output !== "number"
      ) {
        throw new Error("Invalid price map entry");
      }
    }
    return parsed;
  } catch (e) {
    console.warn("[metrics] Failed to parse OPENAI_PRICE_PER_1K_JSON:", e);
    return null;
  }
}

const PRICE_MAP: PriceMap | null = loadPriceMap();

/** התאמת שם מודל למפתח במחיר — תומך גם ב-prefix match (e.g. "gpt-4o-mini-2025-05-xx"). */
function modelKeyForPricing(model: string, map: PriceMap): string | null {
  if (map[model]) return model;
  const prefix = Object.keys(map).find((k) => model.startsWith(k));
  return prefix ?? null;
}

/** חישוב עלות משוערת (USD) לפי טוקנים ומודל. מחזיר null אם אין מפת מחירים או אין התאמה. */
export function estimateOpenAiCost(opts: {
  model: string;
  promptTokens: number;
  completionTokens: number;
}): number | null {
  if (!PRICE_MAP) return null;
  const key = modelKeyForPricing(opts.model, PRICE_MAP);
  if (!key) return null;
  const p = PRICE_MAP[key];
  const cost =
    (opts.promptTokens / 1000) * p.input +
    (opts.completionTokens / 1000) * p.output;
  // עיגול ל־6 ספרות אחרי הנקודה לנוחות
  return Number(cost.toFixed(6));
}

/** ארגומנטים ללוג שימוש ב-AI. */
export type LogAiUsageArgs = {
  userId?: string | null;
  endpoint: string; // לדוגמה: "/api/resume/analyze"
  method: string;   // "POST" | "GET" | "PUT" | ...
  model: string;    // שם מודל כפי שחוזר מ-OpenAI (או מה-ENV)
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;            // t1 - t0 סביב הקריאה ל-OpenAI
  status: "ok" | "error";
  error?: string;               // הודעת שגיאה קצרה במקרה כשל
  costUsd?: number | null;      // אופציונלי — אם לא סופק נחשב משוער דרך estimateOpenAiCost
};

/**
 * רישום שימוש ב-AI:
 * - לא זורק שגיאות; לוכד פנימית ומדפיס console.warn במקרה בעיה.
 * - מקצר error ל-500 תווים כדי למנוע ניפוח DB.
 */
export async function logAiUsage(args: LogAiUsageArgs): Promise<void> {
  try {
    const cost =
      args.costUsd ??
      estimateOpenAiCost({
        model: args.model,
        promptTokens: args.promptTokens,
        completionTokens: args.completionTokens,
      });

    await prisma.aiUsage.create({
      data: {
        userId: args.userId ?? null,
        endpoint: args.endpoint,
        method: args.method,
        model: args.model,
        promptTokens: Math.max(0, Math.floor(args.promptTokens)),
        completionTokens: Math.max(0, Math.floor(args.completionTokens)),
        totalTokens: Math.max(0, Math.floor(args.totalTokens)),
        latencyMs: Math.max(0, Math.floor(args.latencyMs)),
        status: args.status,
        error: args.error ? String(args.error).slice(0, 500) : null,
        costUsd: cost ?? null, // Prisma Decimal יקבל number כאן
      },
    });
  } catch (e) {
    // לוגים לא אמורים להפיל את הראוט
    console.warn("[metrics] logAiUsage failed:", e);
  }
}

/** ארגומנטים ללוג אירוע מוצר. */
export type LogEventArgs = {
  userId?: string | null;
  type: string;          // לדוגמה: "cover_letter_created"
  refId?: string | null; // לדוגמה: applicationDraftId / jobId
  meta?: unknown;        // כל JSON קטן רלוונטי
};

/** רישום אירוע מוצר — גם כאן, לעולם לא מפיל את הראוט. */
export async function logEvent(args: LogEventArgs): Promise<void> {
  try {
    await prisma.usageEvent.create({
      data: {
        userId: args.userId ?? null,
        type: args.type,
        refId: args.refId ?? null,
        meta: args.meta as any,
      },
    });
  } catch (e) {
    console.warn("[metrics] logEvent failed:", e);
  }
}
