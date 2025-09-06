// tests/unit/match.engine.test.ts
import { describe, it, expect } from "vitest";
import { computeMatch } from "@/lib/match/engine";

describe("computeMatch()", () => {
  it("ללא דרישות למשרה ⇒ score=50, coverage=null (N/A)", () => {
    const res = computeMatch({
      candidateSkills: ["ts", "react"],
      candidateYears: 2,
      jobSkills: [], // אין דרישות
      jobLocation: undefined,
    });
    expect(res.score).toBe(50);
    // חוזה בפועל של המנוע: coverage=null כאשר אין דרישות
    expect(res.breakdown.coverage).toBeNull();
  });

  it("ללא סקילז למועמד ⇒ score=0", () => {
    const res = computeMatch({
      candidateSkills: [],
      jobSkills: ["ts", "node"],
    });
    expect(res.score).toBe(0);
    expect(res.breakdown.matched).toEqual([]);
  });

  it("עם חפיפה חלקית", () => {
    const res = computeMatch({
      candidateSkills: ["ts", "react", "node"],
      jobSkills: ["ts", "node", "postgres"],
    });
    expect(res.score).toBeGreaterThan(0);
    expect(res.breakdown.matched).toEqual(expect.arrayContaining(["ts", "node"]));
    expect(res.breakdown.missing).toContain("postgres");
    // כיסוי אמור להיות מספר 0..1 כאשר יש דרישות
    expect(typeof res.breakdown.coverage).toBe("number");
    expect(res.breakdown.coverage!).toBeGreaterThan(0);
    expect(res.breakdown.coverage!).toBeLessThanOrEqual(1);
  });
});
