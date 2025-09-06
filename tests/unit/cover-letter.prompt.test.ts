// tests/unit/cover-letter.prompt.test.ts
import { describe, it, expect } from "vitest";
import { buildCoverLetterPrompt, extractResumeProfile } from "@/lib/cover-letter/prompt";

describe("extractResumeProfile()", () => {
  it("מחזיר פרופיל תקין כאשר מסופק אובייקט מלא", () => {
    const input = {
      skills: ["typescript", "react"],
      tools: ["git", "docker"],
      dbs: ["postgres"],
      highlights: ["built X", "shipped Y"],
    };

    const profile = extractResumeProfile(input as any);
    expect(Array.isArray(profile.skills)).toBe(true);
    expect(Array.isArray(profile.tools)).toBe(true);
    expect(Array.isArray(profile.dbs)).toBe(true);
    // highlights יכול להיות אופציונלי במימושים שונים
    expect(
      Array.isArray((profile as any).highlights) ||
        typeof (profile as any).highlights === "undefined"
    ).toBe(true);

    expect(profile.skills).toEqual(expect.arrayContaining(["typescript", "react"]));
    expect(profile.tools).toEqual(expect.arrayContaining(["git"]));
    expect(profile.dbs).toEqual(expect.arrayContaining(["postgres"]));
  });

  it("מתמודד בחן עם קלט ריק/לא מתועד", () => {
    const profile = extractResumeProfile({} as any);
    expect(Array.isArray(profile.skills)).toBe(true);
    expect(Array.isArray(profile.tools)).toBe(true);
    expect(Array.isArray(profile.dbs)).toBe(true);
  });
});

describe("buildCoverLetterPrompt()", () => {
  const job = {
    id: "j1",
    title: "Frontend Engineer",
    company: "Acme",
    location: "Remote",
    description:
      "We are looking for a frontend engineer with React and TypeScript experience.",
    skillsRequired: ["react", "typescript"],
    url: "https://example.com/job",
  };

  const resume = {
    text: "Experienced frontend dev with React and TS.",
    yearsExp: 3,
    profile: {
      skills: ["react", "typescript"],
      tools: ["git", "vite"],
      dbs: ["postgres"],
      highlights: ["Led UI revamp"],
    },
  };

  it("מחזיר messages עם הנחיות וכולל את maxWords (בכל אחת מההודעות)", () => {
    const { messages } = buildCoverLetterPrompt({
      job,
      resume,
      maxWords: 180,
    });

    expect(Array.isArray(messages)).toBe(true);
    expect(messages.length).toBeGreaterThanOrEqual(2);

    // מחפשים את 180 בכלל ההודעות (לא תלוי role ספציפי)
    const allText = messages.map((m: any) => String(m.content ?? "")).join(" ");
    expect(allText).toMatch(/\b180\b/);

    // לוודא שהפרטים על המשרה/קורות החיים משתקפים איפשהו בהודעות
    expect(allText).toMatch(/Frontend Engineer/i);
    expect(allText).toMatch(/Acme/i);
    expect(allText).toMatch(/React/i);
  });

  it("פועל גם אם yearsExp אינו מסופק", () => {
    const { messages } = buildCoverLetterPrompt({
      job,
      resume: { ...resume, yearsExp: undefined },
      maxWords: 200,
    });

    expect(Array.isArray(messages)).toBe(true);
    const joined = messages.map((m: any) => String(m.content ?? "")).join(" ");
    expect(joined).toMatch(/\b200\b/);
  });
});

/**
 * TODO (שלב המשך):
 * לבדוק זיהוי שפה (he/en) ע"י ייצוא helper קטן (למשל detectLanguage) מתוך prompt.ts
 * ולבדוק אותו ישירות, כדי להימנע מתלות בטקסט מלא של פרומפט.
 */
