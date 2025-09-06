// tests/integration/resume.analyze.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

/** 0) מוקים "מורמים" (hoisted) כדי למנוע ReferenceError בתוך vi.mock factories */
const { prismaMock } = vi.hoisted(() => {
  return {
    prismaMock: {
      resume: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    },
  };
});

const { logAiUsageMock } = vi.hoisted(() => {
  return { logAiUsageMock: vi.fn() };
});

const { openAiCreate } = vi.hoisted(() => {
  return { openAiCreate: vi.fn() };
});

/** 1) mock auth: withUser → מזרים user.id="u1" (פונקציה אינליין מותרת) */
vi.mock("@/lib/auth", () => ({
  withUser:
    (fn: any) =>
    async (req: Request) =>
      fn(req, { user: { id: "u1" } }),
}));

/** 2) mock metrics: מפנים לפונקציה שהוגדרה ב-hoisted */
vi.mock("@/lib/metrics", () => ({
  logAiUsage: logAiUsageMock,
}));

/** 3) mock DB: מפנים לאובייקט prismaMock שהוגדר ב-hoisted */
vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

/** 4) mock OpenAI: מפנים ל-openAiCreate שהוגדר ב-hoisted */
vi.mock("openai", () => {
  return {
    default: class OpenAI {
      chat = {
        completions: {
          create: openAiCreate,
        },
      };
      constructor(_: any) {}
    },
  };
});

/** 5) רק עכשיו מייבאים את ה-POST, אחרי שכל המוקים הוגדרו */
import { POST } from "@/app/api/resume/analyze/route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENAI_API_KEY = "sk-test";

  // ברירת מחדל: הצלחה מהמודל
  openAiCreate.mockResolvedValue({
    model: "gpt-4o-mini",
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    choices: [
      {
        message: {
          content: JSON.stringify({
            skills: ["ts", "react"],
            tools: ["git"],
            dbs: ["postgres"],
            years: 2.6,
            highlights: ["built stuff", "shipped features"],
          }),
        },
      },
    ],
  });
});

describe("POST /api/resume/analyze", () => {
  it("הצלחה: קורא ל-OpenAI, מעדכן Resume ומדווח AiUsage (ok)", async () => {
    prismaMock.resume.findUnique.mockResolvedValueOnce({
      userId: "u1",
      text: "some resume text here",
    });
    prismaMock.resume.update.mockResolvedValueOnce({
      id: "r1",
      yearsExp: 3, // round(2.6)
      skills: {
        skills: ["ts", "react"],
        tools: ["git"],
        dbs: ["postgres"],
        years: 2.6,
        highlights: ["built stuff", "shipped features"],
      },
    });

    const req = new Request("http://localhost/api/resume/analyze", { method: "POST" });
    const res = await POST(req);
    expect(res.ok).toBe(true);

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.resumeId).toBe("r1");
    expect(json.yearsExp).toBe(3);
    expect(json.profile.skills).toEqual(expect.arrayContaining(["ts", "react"]));

    expect(openAiCreate).toHaveBeenCalledTimes(1);
    expect(prismaMock.resume.update).toHaveBeenCalledWith({
      where: { userId: "u1" },
      data: {
        skills: expect.objectContaining({ skills: expect.any(Array) }),
        yearsExp: 3,
      },
      select: { id: true, yearsExp: true, skills: true },
    });

    expect(logAiUsageMock).toHaveBeenCalledTimes(1);
    expect(logAiUsageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        endpoint: "/api/resume/analyze",
        method: "POST",
        model: "gpt-4o-mini",
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        status: "ok",
      })
    );
    expect(typeof logAiUsageMock.mock.calls[0][0].latencyMs).toBe("number");
  });

  it("אין טקסט בקו״ח → 400, ללא OpenAI/metrics", async () => {
    prismaMock.resume.findUnique.mockResolvedValueOnce({
      userId: "u1",
      text: "   ", // ריק אחרי trim
    });

    const req = new Request("http://localhost/api/resume/analyze", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe("no resume text to analyze");

    expect(openAiCreate).not.toHaveBeenCalled();
    expect(logAiUsageMock).not.toHaveBeenCalled();
  });

  it("שגיאת OpenAI → הראוט זורק ו־logAiUsage נקרא עם status:error", async () => {
    prismaMock.resume.findUnique.mockResolvedValueOnce({
      userId: "u1",
      text: "valid text",
    });

    openAiCreate.mockRejectedValueOnce(new Error("boom"));

    const req = new Request("http://localhost/api/resume/analyze", { method: "POST" });
    await expect(POST(req)).rejects.toThrow("boom");

    expect(logAiUsageMock).toHaveBeenCalledTimes(1);
    expect(logAiUsageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        endpoint: "/api/resume/analyze",
        method: "POST",
        model: "gpt-4o-mini",
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        status: "error",
        error: "boom",
      })
    );
  });
});
