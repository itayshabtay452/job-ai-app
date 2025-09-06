// tests/unit/validation.coverLetter.test.ts
import { describe, it, expect } from "vitest";
import {
  PostCoverLetterSchema,
  PutCoverLetterSchema,
  wordCount,
} from "@/lib/validation/coverLetter";

describe("PostCoverLetterSchema", () => {
  it("מאשר אובייקט ללא maxWords (אופציונלי)", () => {
    const res = PostCoverLetterSchema.safeParse({});
    expect(res.success).toBe(true);
    expect(res.data).toEqual({});
  });

  it("מאשר maxWords בתחום [80..400]", () => {
    expect(PostCoverLetterSchema.safeParse({ maxWords: 80 }).success).toBe(true);
    expect(PostCoverLetterSchema.safeParse({ maxWords: 180 }).success).toBe(true);
    expect(PostCoverLetterSchema.safeParse({ maxWords: 400 }).success).toBe(true);
  });

  it("דוחה maxWords שאינו מספר", () => {
    const res = PostCoverLetterSchema.safeParse({ maxWords: "200" as any });
    expect(res.success).toBe(false);
  });

  it("דוחה maxWords מחוץ לטווח", () => {
    expect(PostCoverLetterSchema.safeParse({ maxWords: 79 }).success).toBe(false);
    expect(PostCoverLetterSchema.safeParse({ maxWords: 401 }).success).toBe(false);
  });

  it("דוחה maxWords לא שלם (int)", () => {
    const res = PostCoverLetterSchema.safeParse({ maxWords: 123.45 });
    expect(res.success).toBe(false);
  });
});

describe("PutCoverLetterSchema", () => {
  it("מאשר מכתב לא ריק (אחרי trim)", () => {
    const ok = PutCoverLetterSchema.safeParse({ coverLetter: "  hi  " });
    expect(ok.success).toBe(true);
    expect(ok.success && ok.data.coverLetter).toBe("hi");
  });

  it("דוחה מכתב ריק (אחרי trim)", () => {
    const res = PutCoverLetterSchema.safeParse({ coverLetter: "   " });
    expect(res.success).toBe(false);
  });

  it("דוחה כשאין coverLetter", () => {
    const res = PutCoverLetterSchema.safeParse({} as any);
    expect(res.success).toBe(false);
  });
});

describe("wordCount()", () => {
  it("סופר 0 עבור ריק/רווחים", () => {
    expect(wordCount("")).toBe(0);
    expect(wordCount("   ")).toBe(0);
    expect(wordCount("\n\t ")).toBe(0);
  });

  it("סופר מילים מופרדות ברווחים מרובים", () => {
    expect(wordCount("hello world")).toBe(2);
    expect(wordCount("hello   next   js")).toBe(3);
    expect(wordCount("שלום עולם טוב")).toBe(3);
  });

  it("מתמודד גם עם שורות חדשות/טאבים", () => {
    expect(wordCount("a\nb\tc")).toBe(3);
  });
});
