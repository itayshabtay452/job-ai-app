// tests/integration/metrics.summary.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

/** 0) hoisted mocks כדי להימנע מ-ReferenceError בתוך vi.mock factories */
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    aiUsage: { aggregate: vi.fn() },
    usageEvent: { count: vi.fn() },
  },
}));

/** 1) withUser → user.id="u1" */
vi.mock("@/lib/auth", () => ({
  withUser:
    (fn: any) =>
    async (req: Request) =>
      fn(req, { user: { id: "u1" } }),
}));

/** 2) DB: Prisma */
vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

/** 3) ייבוא הראוט אחרי המוקים */
import { GET } from "@/app/api/metrics/summary/route";

beforeEach(() => {
  vi.resetAllMocks();

  // ברירות מחדל: aggregate מחזיר ערכים תקינים
  prismaMock.aiUsage.aggregate.mockResolvedValue({
    _count: 3, // שים לב: בקוד שלנו השתמשנו _count: true ומצפים למספר
    _sum: {
      promptTokens: 120,
      completionTokens: 80,
      totalTokens: 200,
      costUsd: 0.123456,
    },
    _avg: { latencyMs: 250 },
  });

  // מוני אירועים
  prismaMock.usageEvent.count
    .mockResolvedValueOnce(2) // created
    .mockResolvedValueOnce(1); // regenerated
});

describe("GET /api/metrics/summary", () => {
  it("ברירת מחדל: days=7, מחזיר אגרגציות AI ואירועים", async () => {
    const req = new Request("http://localhost/api/metrics/summary", { method: "GET" });
    const res = await GET(req);
    expect(res.ok).toBe(true);

    const json = await res.json();
    expect(json.ok).toBe(true);

    // טווח
    expect(json.range.days).toBe(7);
    expect(typeof json.range.from).toBe("string");
    expect(typeof json.range.to).toBe("string");

    // AI
    expect(json.ai.calls).toBe(3);
    expect(json.ai.promptTokens).toBe(120);
    expect(json.ai.completionTokens).toBe(80);
    expect(json.ai.totalTokens).toBe(200);
    // ממוצע latency מעוגל (תלוי מימוש; נבדוק שהוא מספר)
    expect(typeof json.ai.avgLatencyMs).toBe("number");
    // cost יכול להיות מספר או null (תלוי אם אין נתון) — כאן מצפים למספר
    expect(json.ai.costUsd).toBeCloseTo(0.123456, 6);

    // Cover letters
    expect(json.coverLetters.created).toBe(2);
    expect(json.coverLetters.regenerated).toBe(1);
  });

  it("days=14 → מוחזר ב-range.days; מתמודד עם null/undefined מסיכומים", async () => {
    // הפעם נחזיר ערכי null כדי לוודא שיוצא 0/Null-safe
    prismaMock.aiUsage.aggregate.mockResolvedValueOnce({
      _count: 0,
      _sum: {
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        costUsd: null,
      },
      _avg: { latencyMs: null },
    });
    prismaMock.usageEvent.count.mockReset();
    prismaMock.usageEvent.count
      .mockResolvedValueOnce(0) // created
      .mockResolvedValueOnce(0); // regenerated

    const req = new Request("http://localhost/api/metrics/summary?days=14", { method: "GET" });
    const res = await GET(req);
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.range.days).toBe(14);

    expect(json.ai.calls).toBe(0);
    expect(json.ai.promptTokens).toBe(0);
    expect(json.ai.completionTokens).toBe(0);
    expect(json.ai.totalTokens).toBe(0);
    // ממוצע ריק → 0 (או null לפי המימוש שלך; כאן מניחים 0)
    expect([0, null]).toContain(json.ai.avgLatencyMs);
    // cost ריק → null (מניחים שזו בחירתנו)
    expect(json.ai.costUsd === null || json.ai.costUsd === 0).toBe(true);

    expect(json.coverLetters.created).toBe(0);
    expect(json.coverLetters.regenerated).toBe(0);
  });
});
