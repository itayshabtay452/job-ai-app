// tests/integration/jobs.list.route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

/** hoisted mocks כדי למנוע בעיות hoisting */
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    job: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

/** חיבור Prisma מזויף */
vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

/** מייבאים את הראוט רק אחרי המוקים */
import { GET } from "@/app/api/jobs/list/route";

beforeEach(() => {
  vi.resetAllMocks();

  prismaMock.job.count.mockResolvedValue(1);
  prismaMock.job.findMany.mockResolvedValue([
    {
      id: "j1",
      title: "Frontend Engineer",
      company: "Acme",
      location: "Tel Aviv",
      skillsRequired: ["react", "typescript"],
      url: null,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
    },
  ]);
});

describe("GET /api/jobs/list", () => {
  it("ברירת מחדל: 200 + page=1, pageSize=20 + skip/take נכונים", async () => {
    const req = new Request("http://localhost/api/jobs/list");
    const res = await GET(req);
    expect(res.ok).toBe(true);

    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.page).toBe(1);
    expect(json.pageSize).toBe(20);
    expect(json.total).toBe(1);
    expect(Array.isArray(json.items)).toBe(true);
    expect(json.items[0].id).toBe("j1");

    // וידוא פרמטרים ל-Prisma
    expect(prismaMock.job.count).toHaveBeenCalledWith({ where: {} });
    expect(prismaMock.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 20,
        select: expect.any(Object),
      })
    );
  });

  it("pageSize גדול מדי ⇒ 400 ZOD_INVALID_QUERY", async () => {
    const req = new Request("http://localhost/api/jobs/list?pageSize=999");
    const res = await GET(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe("ZOD_INVALID_QUERY");
    expect(Array.isArray(json.issues)).toBe(true);
  });

  it("skill עם אותיות גדולות → ננעל ל-lowercase ב־where.has", async () => {
    const req = new Request("http://localhost/api/jobs/list?skill=React");
    const res = await GET(req);
    expect(res.ok).toBe(true);

    // where צפוי: { AND: [ { skillsRequired: { has: 'react' } } ] }
    const whereArg = (prismaMock.job.count.mock.calls[0][0] as any).where;
    expect(whereArg).toEqual({
      AND: [ { skillsRequired: { has: "react" } } ],
    });
  });

  it("q יוצר OR על title/company/location/description עם contains+insensitive", async () => {
    const req = new Request("http://localhost/api/jobs/list?q=fullstack");
    const res = await GET(req);
    expect(res.ok).toBe(true);

    const whereArg = (prismaMock.job.count.mock.calls[0][0] as any).where;
    expect(whereArg.AND).toBeDefined();
    const or = whereArg.AND[0].OR;

    expect(or).toEqual(
      expect.arrayContaining([
        { title: { contains: "fullstack", mode: "insensitive" } },
        { company: { contains: "fullstack", mode: "insensitive" } },
        { location: { contains: "fullstack", mode: "insensitive" } },
        { description: { contains: "fullstack", mode: "insensitive" } },
      ])
    );
  });

  it("עימוד: page=2&pageSize=10 ⇒ skip=10, take=10, וחזרה מתאימה", async () => {
    const req = new Request("http://localhost/api/jobs/list?page=2&pageSize=10");
    const res = await GET(req);
    const json = await res.json();

    expect(json.page).toBe(2);
    expect(json.pageSize).toBe(10);

    expect(prismaMock.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      })
    );
  });

  it("location יוצר contains+insensitive", async () => {
    const req = new Request("http://localhost/api/jobs/list?location=TLV");
    const res = await GET(req);
    expect(res.ok).toBe(true);

    const whereArg = (prismaMock.job.count.mock.calls[0][0] as any).where;
    expect(whereArg.AND).toEqual(
      expect.arrayContaining([
        { location: { contains: "TLV", mode: "insensitive" } },
      ])
    );
  });

  it("שגיאה פנימית (findMany נופל) ⇒ 500 INTERNAL_ERROR", async () => {
    // נסדר שקאונט עובר, אבל findMany זורק
    prismaMock.job.count.mockResolvedValueOnce(42);
    prismaMock.job.findMany.mockRejectedValueOnce(new Error("DB down"));

    const req = new Request("http://localhost/api/jobs/list");
    const res = await GET(req);
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe("INTERNAL_ERROR");
  });
});
