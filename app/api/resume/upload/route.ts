// C:\Users\itays\Desktop\33\job-ai-app\app\api\resume\upload\route.ts
import { NextResponse } from "next/server";
import { writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const runtime = "nodejs"; // מוודא ריצה על Node (לא edge)

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "missing file" }, { status: 400 });
    }

    // בדיקות בסיסיות
    const filename = file.name || "resume.pdf";
    const size = file.size;
    if (size === 0) return NextResponse.json({ error: "empty file" }, { status: 400 });
    if (size > 5 * 1024 * 1024)
      return NextResponse.json({ error: "file too large (max 5MB)" }, { status: 400 });

    // בדיקת סיומת ותוכן בסיסית
    const lower = filename.toLowerCase();
    if (!lower.endsWith(".pdf"))
      return NextResponse.json({ error: "only PDF allowed" }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());

    // חתימת PDF בסיסית (%PDF בתחילת הקובץ)
    const header = buf.subarray(0, 4).toString("utf8");
    if (!header.startsWith("%PDF")) {
      return NextResponse.json({ error: "invalid pdf signature" }, { status: 400 });
    }

    // שמירה זמנית (נשתמש בזה בשלב הבא ל-parsing)
    const id = randomUUID();
    const tmpPath = join(tmpdir(), `resume-${id}.pdf`);
    await writeFile(tmpPath, buf, { flag: "wx" }); // נכשל אם קיים – מגן מפני דריסה

    return NextResponse.json({ ok: true, id, bytes: size });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "upload error" }, { status: 500 });
  }
}
// #endregion
