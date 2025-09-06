// tests/integration/cover-letter.route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

/** 0) מוקים "מורמים" (hoisted) כדי למנוע ReferenceError בתוך vi.mock factories */
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    job: { findUnique: vi.fn() },
    resume: { findUnique: vi.fn() },
    applicationDraft: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const { rateLimitTouchMock, rateLimitHeadersMock } = vi.hoisted(() => ({
  rateLimitTouchMock: vi.fn(),
  rateLimitHeadersMock: vi.fn(),
}));

const { buildPromptMock, extractResumeProfileMock } = vi.hoisted(() => ({
  buildPromptMock: vi.fn(),
  extractResumeProfileMock: vi.fn(),
}));

const { openAiCreate } = vi.hoisted(() => ({
  openAiCreate: vi.fn(),
}));

const { logAiUsageMock, logEventMock } = vi.hoisted(() => ({
  logAiUsageMock: vi.fn(),
  logEventMock: vi.fn(),
}));

/** 1) auth: withUser → user.id="u1" */
vi.mock("@/lib/auth", () => ({
  withUser:
    (fn: any) =>
    async (req: Request) =>
      fn(req, { user: { id: "u1" } }),
}));

/** 2) RL: נשלוט ב-ok/blocked ונחזיר כותרות צפויות */
vi.mock("@/lib/security/rateLimit", () => ({
  rateLimitTouch: rateLimitTouchMock,
  rateLimitHeaders: rateLimitHeadersMock,
}));

/** 3) DB: Prisma */
vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

/** 4) פרומפט/פרופיל */
vi.mock("@/lib/cover-letter/prompt", () => ({
  buildCoverLetterPrompt: buildPromptMock,
  extractResumeProfile: extractResumeProfileMock,
}));

/** 5) OpenAI */
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

/** 6) metrics */
vi.mock("@/lib/metrics", () => ({
  logAiUsage: logAiUsageMock,
  logEvent: logEventMock,
}));

/** 7) ייבוא הראוטים אחרי המוקים */
import { GET, POST, PUT } from "@/app/api/jobs/[id]/cover-letter/route";

beforeEach(() => {
  vi.resetAllMocks();
  process.env.OPENAI_API_KEY = "sk-test";

  // בררת מחדל: RL מאושר + כותרות יציבות
  rateLimitTouchMock.mockReturnValue({ ok: true });
  rateLimitHeadersMock.mockImplementation((_rl: any, limit: number) => {
    return new Headers({ "X-RateLimit-Limit": String(limit) });
  });

  // בררת מחדל: משרה קיימת
  prismaMock.job.findUnique.mockResolvedValue({ id: "j1" });

  // בררת מחדל: יש רזומה
  prismaMock.resume.findUnique.mockResolvedValue({
    userId: "u1",
    text: "resume text",
    skills: { skills: ["react"], tools: ["git"], dbs: ["postgres"] },
    yearsExp: 2,
  });

  // פרופיל "עדין"
  extractResumeProfileMock.mockReturnValue({
    skills: ["react"],
    tools: ["git"],
    dbs: ["postgres"],
    highlights: ["built X"],
  });

  // פרומפט קבוע
  buildPromptMock.mockReturnValue({
    messages: [
      { role: "system", content: "write a cover letter up to 120 words" },
      { role: "user", content: "job+resume context" },
    ],
  });

  // OpenAI הצלחה בררת מחדל — תוכן קצר (<= 120 מילים)
  openAiCreate.mockResolvedValue({
    model: "gpt-4o-mini",
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    choices: [{ message: { content: "Hello hiring manager, ..." } }],
  });
});

function reqJson(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/jobs/[id]/cover-letter", () => {
  it("יצירה ראשונה (אין טיוטה) ⇒ create + logAiUsage(ok) + logEvent(created)", async () => {
    prismaMock.applicationDraft.findFirst.mockResolvedValueOnce(null);
    const saved = {
      id: "d1",
      coverLetter: "Hello hiring manager, ...",
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    };
    prismaMock.applicationDraft.create.mockResolvedValueOnce(saved);

    const req = reqJson("http://localhost/api/jobs/j1/cover-letter", { maxWords: 120 });
    const res = await POST(req, { params: { id: "j1" } });

    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.maxWords).toBe(120);
    expect(json.draft).toEqual({
      id: "d1",
      coverLetter: saved.coverLetter,
      updatedAt: "2024-01-01T00:00:00.000Z",
    });

    expect(prismaMock.applicationDraft.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.applicationDraft.update).not.toHaveBeenCalled();

    expect(logAiUsageMock).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "/api/jobs/[id]/cover-letter", status: "ok" })
    );
    expect(logEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        type: "cover_letter_created",
        refId: "d1",
        meta: { jobId: "j1" },
      })
    );

    // וידוא כותרת RateLimit
    expect(res.headers.get("X-RateLimit-Limit")).toBe("5"); // LIMIT בפוסט
  });

  it("רג'נרציה (יש טיוטה) ⇒ update + logEvent(regenerated)", async () => {
    prismaMock.applicationDraft.findFirst.mockResolvedValueOnce({ id: "d1" });
    const saved = {
      id: "d1",
      coverLetter: "Updated letter",
      updatedAt: new Date("2024-02-02T00:00:00.000Z"),
    };
    prismaMock.applicationDraft.update.mockResolvedValueOnce(saved);

    const req = reqJson("http://localhost/api/jobs/j1/cover-letter", { maxWords: 120 });
    const res = await POST(req, { params: { id: "j1" } });
    expect(res.ok).toBe(true);

    const json = await res.json();
    expect(json.draft.id).toBe("d1");
    expect(prismaMock.applicationDraft.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.applicationDraft.create).not.toHaveBeenCalled();
    expect(logEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "cover_letter_regenerated" })
    );
  });

  it("חריגה ממגבלת מילים ⇒ 422 OVER_WORD_LIMIT", async () => {
    // תוכן גדול מהמגבלה: 121 מילים כשmaxWords=120
    const longContent = Array.from({ length: 121 }, () => "w").join(" ");
    openAiCreate.mockResolvedValueOnce({
      model: "gpt-4o-mini",
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      choices: [{ message: { content: longContent } }],
    });
    prismaMock.applicationDraft.findFirst.mockResolvedValueOnce(null);

    const req = reqJson("http://localhost/api/jobs/j1/cover-letter", { maxWords: 120 });
    const res = await POST(req, { params: { id: "j1" } });

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe("OVER_WORD_LIMIT");
    expect(json.maxWords).toBe(120);

    expect(prismaMock.applicationDraft.create).not.toHaveBeenCalled();
    expect(prismaMock.applicationDraft.update).not.toHaveBeenCalled();
    // שים לב: logAiUsage( ok ) עדיין נקרא (כי הקריאה ל-OpenAI הצליחה)
    expect(logAiUsageMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ok" })
    );
  });

  it("אין קורות חיים ⇒ 422 NO_RESUME, ללא OpenAI/metrics", async () => {
    prismaMock.resume.findUnique.mockResolvedValueOnce(null);

    const req = reqJson("http://localhost/api/jobs/j1/cover-letter", { maxWords: 120 });
    const res = await POST(req, { params: { id: "j1" } });

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe("NO_RESUME");

    expect(openAiCreate).not.toHaveBeenCalled();
    expect(logAiUsageMock).not.toHaveBeenCalled();
  });

  it("שגיאת OpenAI ⇒ הראוט זורק ו־logAiUsage(error) נקרא", async () => {
    prismaMock.applicationDraft.findFirst.mockResolvedValueOnce(null);
    openAiCreate.mockRejectedValueOnce(new Error("boom"));

    const req = reqJson("http://localhost/api/jobs/j1/cover-letter", { maxWords: 120 });
    await expect(POST(req, { params: { id: "j1" } })).rejects.toThrow("boom");

    expect(logAiUsageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "/api/jobs/[id]/cover-letter",
        status: "error",
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        error: "boom",
      })
    );
  });
});

describe("GET /api/jobs/[id]/cover-letter", () => {
  it("מחזיר draft=null כשאין טיוטה, עם כותרת RL", async () => {
    prismaMock.applicationDraft.findFirst.mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/jobs/j1/cover-letter");
    const res = await GET(req, { params: { id: "j1" } });

    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.draft).toBeNull();

    expect(res.headers.get("X-RateLimit-Limit")).toBe("30"); // LIMIT ב-GET
  });
});

describe("PUT /api/jobs/[id]/cover-letter", () => {
  it("עדכון ידני תקין ⇒ 200", async () => {
    prismaMock.applicationDraft.findFirst.mockResolvedValueOnce({ id: "d1" });
    prismaMock.applicationDraft.update.mockResolvedValueOnce({
      id: "d1",
      coverLetter: "ok",
      updatedAt: new Date("2024-03-03T00:00:00.000Z"),
    });

    const req = new Request("http://localhost/api/jobs/j1/cover-letter", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ coverLetter: "ok" }),
    });
    const res = await PUT(req, { params: { id: "j1" } });

    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.draft.id).toBe("d1");
  });
});
