// scripts/test-cover-prompt.ts
import { buildCoverLetterPrompt, detectLanguageFromJob, extractResumeProfile } from "../lib/cover-letter/prompt";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (e) {
    console.error(`❌ ${name}`);
    console.error(e);
    process.exitCode = 1;
  }
}

const jobHe = {
  title: "מפתח/ת Fullstack",
  company: "Acme",
  location: "תל אביב",
  description: "אנחנו מחפשים מפתח/ת עם ניסיון ב-React ו-Node, יתרון ל-PostgreSQL.",
  skillsRequired: ["react", "node", "postgresql"],
};

const jobEn = {
  title: "Fullstack Engineer",
  company: "Globex",
  location: "Berlin",
  description: "Looking for an engineer with React and Node experience. Advantage: PostgreSQL.",
  skillsRequired: ["react", "node", "postgresql"],
};

const resume = {
  text: "some resume text...",
  skills: {
    skills: ["React", "TypeScript", "Node"],
    tools: ["Git", "Docker"],
    dbs: ["PostgreSQL", "MongoDB"],
    highlights: ["Delivered feature X improving conversion by 12%"],
  },
  yearsExp: 2,
};

test("detectLanguageFromJob detects Hebrew", () => {
  const lang = detectLanguageFromJob(jobHe);
  if (lang !== "he") throw new Error(`expected "he", got ${lang}`);
});

test("detectLanguageFromJob detects English", () => {
  const lang = detectLanguageFromJob(jobEn);
  if (lang !== "en") throw new Error(`expected "en", got ${lang}`);
});

test("extractResumeProfile merges arrays properly", () => {
  const p = extractResumeProfile(resume.skills);
  if (!p.skills.includes("React")) throw new Error("React missing from skills");
  if (!p.tools.includes("Git")) throw new Error("Git missing from tools");
  if (!p.dbs.includes("PostgreSQL")) throw new Error("PostgreSQL missing from dbs");
  if (!p.highlights[0]?.includes("12%")) throw new Error("highlight missing");
});

test("buildCoverLetterPrompt clamps maxWords and builds messages", () => {
  const built1 = buildCoverLetterPrompt({ job: jobEn, resume, maxWords: 30 });  // נמוך מדי → יצמד ל-80
  if (built1.maxWords !== 80) throw new Error(`expected maxWords=80, got ${built1.maxWords}`);
  if (built1.messages.length !== 2) throw new Error("expected 2 messages (system+user)");

  const built2 = buildCoverLetterPrompt({ job: jobHe, resume, maxWords: 999 }); // גבוה מדי → יצמד ל-400
  if (built2.maxWords !== 400) throw new Error(`expected maxWords=400, got ${built2.maxWords}`);
  if (built2.language !== "he") throw new Error(`expected he, got ${built2.language}`);
});

console.log("\nSample prompt (he, 220 words):\n");
const sample = buildCoverLetterPrompt({ job: jobHe as any, resume, maxWords: 220 });
console.log(sample);
