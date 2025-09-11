// app/api/resume/upload/route.ts
import { NextResponse } from "next/server";
import { writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // ליתר בטחון ב-POST

function bad(code: string, status = 400, extra?: Record<string, any>) {
  // מחזיר גם error וגם code כדי שה-UI שלך יתפוס upData.error
  return NextResponse.json({ ok: false, error: code, code, ...extra }, { status });
}

export const POST = withUser(async (req) => {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return bad("INVALID_CONTENT_TYPE", 415, { ct });
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch (e) {
      console.error("[upload] formData() failed:", e);
      return bad("FORMDATA_PARSE_FAILED", 400);
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return bad("MISSING_FILE", 400);
    }

    const filename = file.name || "resume.pdf";
    const size = file.size ?? 0;

    if (size <= 0) return bad("EMPTY_FILE", 400);
    if (size > 5 * 1024 * 1024) return bad("FILE_TOO_LARGE", 400, { max: 5 * 1024 * 1024 });

    const lower = filename.toLowerCase();
    if (!lower.endsWith(".pdf")) return bad("ONLY_PDF_ALLOWED", 400, { filename });

    // הופך את ה-File לבופר
    const buf = Buffer.from(await file.arrayBuffer());

    // חתימת PDF בסיסית
    const header = buf.subarray(0, 4).toString("utf8");
    if (!header.startsWith("%PDF")) {
      return bad("INVALID_PDF_SIGNATURE", 400);
    }

    // כותבים ל-TMP
    const id = randomUUID();
    const tmpPath = join(tmpdir(), `resume-${id}.pdf`);

    try {
      // לא משתמשים ב-'wx' כדי לא לקבל בעיות permission נדירות בוינדוס
      await writeFile(tmpPath, buf);
    } catch (e: any) {
      console.error("[upload] writeFile failed:", e);
      return bad("WRITE_FAILED", 500, { message: e?.message });
    }

    return NextResponse.json({ ok: true, id, bytes: size });
  } catch (e: any) {
    console.error("[upload] UNHANDLED:", e);
    return bad("UNKNOWN", 500, { message: e?.message });
  }
});
