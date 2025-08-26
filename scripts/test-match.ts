// scripts/test-match.ts
import { computeMatch } from "../lib/match/engine";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

test("אין דרישות → 50", () => {
  const out = computeMatch({ candidateSkills: ["React"], jobSkills: [] });
  if (out.score !== 50) throw new Error(`expected 50, got ${out.score}`);
});

test("אין סקילז למועמד → 0", () => {
  const out = computeMatch({ candidateSkills: [], jobSkills: ["react", "ts"] });
  if (out.score !== 0) throw new Error(`expected 0, got ${out.score}`);
  if (out.breakdown.missing.length !== 2) throw new Error("missing should include both");
});

test("כיסוי מלא → 100", () => {
  const out = computeMatch({
    candidateSkills: ["React", "TypeScript", "Node"],
    jobSkills: ["react", "typescript"],
  });
  if (out.score !== 100) throw new Error(`expected 100, got ${out.score}`);
  if (out.breakdown.missing.length !== 0) throw new Error("should have no missing");
});

test("כיסוי 50%", () => {
  const out = computeMatch({
    candidateSkills: ["react"],
    jobSkills: ["react", "typescript"],
  });
  if (out.score !== 50) throw new Error(`expected 50, got ${out.score}`);
  if (out.breakdown.matched[0] !== "react") throw new Error("matched should be react");
});

test("נירמול + dedupe", () => {
  const out = computeMatch({
    candidateSkills: ["  React ", "react", "ReAcT", " TS "],
    jobSkills: ["react", "ts"],
  });
  if (out.score !== 100) throw new Error(`expected 100, got ${out.score}`);
});
