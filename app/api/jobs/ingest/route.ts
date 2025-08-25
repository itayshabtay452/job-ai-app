import { NextResponse } from "next/server";         // אפשר להשאיר רק NextResponse
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { prisma } from "@/lib/db";
import { withUser } from "@/lib/auth";
import { normalizeFeed, NormalizedJob } from "@/lib/jobs/normalize";

export const runtime = "nodejs";

/**
 * POST /api/jobs/ingest
 * - ללא גוף: קורא data/jobs-feed.json
 * - עם גוף JSON Array: משתמש בו
 */
export const POST = withUser(async (req: Request) => {
  let raw: any = null;

  // נסה לקרוא גוף JSON (לא חובה)
  try {
    raw = await req.json().catch(() => null);
  } catch {
    raw = null;
  }

  // fallback לפיד המקומי
  if (!raw) {
    const p = join(process.cwd(), "data", "jobs-feed.json");
    const buf = await readFile(p);
    raw = JSON.parse(buf.toString());
  }

  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "feed must be a JSON array" }, { status: 400 });
  }

  const items: NormalizedJob[] = normalizeFeed(raw);

  // שליפת קיימים לצורך מונה created/updated מדויק
  const keys = items.map(i => ({ source: i.source, externalId: i.externalId }));
  const existing = await prisma.job.findMany({
    where: {
      OR: keys.map(k => ({ source: k.source, externalId: k.externalId })), // ← תיקון כאן
    },
    select: { source: true, externalId: true },
  });
  const exists = new Set(existing.map(e => `${e.source}::${e.externalId}`));

  let created = 0, updated = 0, skipped = 0;

  for (const j of items) {
    try {
      await prisma.job.upsert({
        where: { source_externalId: { source: j.source, externalId: j.externalId } },
        update: {
          title: j.title,
          company: j.company,
          location: j.location ?? undefined,
          description: j.description,
          skillsRequired: j.skillsRequired,
          url: j.url ?? undefined,
        },
        create: {
          source: j.source,
          externalId: j.externalId,
          title: j.title,
          company: j.company,
          location: j.location ?? undefined,
          description: j.description,
          skillsRequired: j.skillsRequired,
          url: j.url ?? undefined,
        },
      });

      const k = `${j.source}::${j.externalId}`;
      if (exists.has(k)) updated++; else created++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, total: items.length, created, updated, skipped });
});
