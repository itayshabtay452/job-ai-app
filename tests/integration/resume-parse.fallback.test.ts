
import { describe, it, expect, vi } from "vitest";

// מוקים ל-Prisma ול-auth
vi.mock("@/lib/db", () => ({
  prisma: {
    resume: {
      findUnique: vi.fn().mockResolvedValue({ id: "r1", text: "hello world" }),
      upsert: vi.fn(),
    },
  },
}));
vi.mock("@/lib/auth", () => ({
  withUser:
    (handler: any) =>
    (req: Request) =>
      handler(req, { user: { id: "u1", email: "u@example.com" } }),
}));

// אל תיכשלו על ניסיונות unlink
vi.mock("node:fs/promises", async (orig) => {
  const mod: any = await orig();
  return {
    ...mod,
    readFile: vi.fn().mockRejectedValue(new Error("ENOENT")),
    unlink: vi.fn().mockRejectedValue(new Error("ENOENT")),
  };});

import { POST as parseRoute } from "@/app/api/resume/parse/route";

describe("resume/parse fallback behavior on serverless (no tmp file)", () => {
  it("returns success from DB when tmp file is missing", async () => {
    const res = await parseRoute(
      // body עם id שלא באמת קיים ב-tmp
      new Request("http://localhost/api/resume/parse", {
        method: "POST",
        body: JSON.stringify({ id: "non-existent" }),
        headers: { "content-type": "application/json" },
      })
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.resumeId).toBe("r1");
    expect(json.chars).toBeGreaterThan(0);
  });
});
