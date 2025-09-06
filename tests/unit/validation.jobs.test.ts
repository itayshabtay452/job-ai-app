// tests/unit/validation.jobs.test.ts
import { describe, it, expect } from "vitest";
import { JobsListQuerySchema, type JobsListQuery } from "@/lib/validation/jobs";

describe("JobsListQuerySchema", () => {
  it("ברירות מחדל: page=1, pageSize=20", () => {
    const res = JobsListQuerySchema.safeParse({});
    expect(res.success).toBe(true);
    const data = res.data as JobsListQuery;
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(20);
  });

  it("coerce למספרים מתוך מחרוזות", () => {
    const res = JobsListQuerySchema.safeParse({ page: "3", pageSize: "10" });
    expect(res.success).toBe(true);
    const data = res.data as JobsListQuery;
    expect(data.page).toBe(3);
    expect(data.pageSize).toBe(10);
  });

  it("דוחה page < 1 ו-pageSize מחוץ לטווח (או >50)", () => {
    expect(JobsListQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(JobsListQuerySchema.safeParse({ pageSize: 0 }).success).toBe(false);
    expect(JobsListQuerySchema.safeParse({ pageSize: 51 }).success).toBe(false);
  });

  it("דוחה page/pageSize לא שלמים", () => {
    expect(JobsListQuerySchema.safeParse({ page: 1.2 }).success).toBe(false);
    expect(JobsListQuerySchema.safeParse({ pageSize: 2.8 }).success).toBe(false);
    // גם coercion ממחרוזת לא שלמה צריך ליפול:
    expect(JobsListQuerySchema.safeParse({ page: "2.5" }).success).toBe(false);
  });

  it("trim לשדות טקסטואלים + skill ל-lowercase", () => {
    const res = JobsListQuerySchema.safeParse({
      q: "  React Dev   ",
      location: "  Tel Aviv  ",
      skill: "  ReAcT  ",
    });
    expect(res.success).toBe(true);
    const data = res.data as JobsListQuery;
    expect(data.q).toBe("React Dev");
    expect(data.location).toBe("Tel Aviv");
    expect(data.skill).toBe("react");
  });

  it("דוחה q/location ארוכים מדי (200/120 בהתאמה)", () => {
    const long = "x".repeat(201);
    const longLoc = "y".repeat(121);
    expect(JobsListQuerySchema.safeParse({ q: long }).success).toBe(false);
    expect(JobsListQuerySchema.safeParse({ location: longLoc }).success).toBe(false);
  });
});
