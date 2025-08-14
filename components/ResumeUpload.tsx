"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";

type ParseResultOK = { ok: true; resumeId: string; pageCount: number; chars: number };
type ParseResultNeedsOCR = { ok: true; id: string; status: "needs_ocr"; pageCount: number };
type ParseResultError = { error: string };
type ParseResult = ParseResultOK | ParseResultNeedsOCR | ParseResultError;

export default function ResumeUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "parsing" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string>("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function validate(f: File) {
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setMsg("נא לבחור קובץ PDF בלבד");
      return false;
    }
    if (f.size > 5 * 1024 * 1024) {
      setMsg("קובץ גדול מדי (מקסימום 5MB)");
      return false;
    }
    return true;
  }

  function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!validate(f)) return setFile(null);
    resetView();
    setFile(f);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!validate(f)) return setFile(null);
    resetView();
    setFile(f);
  }

  function resetView() {
    setPhase("idle");
    setMsg("");
    setResult(null);
  }

  async function handleUploadAndParse() {
    if (!file) return;
    try {
      // --- Upload ---
      setPhase("uploading");
      setMsg("");
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch("/api/resume/upload", { method: "POST", body: fd });
      const upData = await upRes.json();
      if (!upRes.ok) throw new Error(upData?.error || "שגיאה בהעלאה");

      const tempId: string = upData.id;
      setMsg(`העלאה הושלמה (id: ${tempId}). ממשיכים לניתוח…`);

      // --- Parse (auto) ---
      setPhase("parsing");
      const parseRes = await fetch("/api/resume/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tempId }),
      });
      const parseData: ParseResult = await parseRes.json();
      if (!parseRes.ok) {
        const err = (parseData as any)?.error || "שגיאה בניתוח";
        throw new Error(err);
      }

      setResult(parseData);
      setPhase("done");

      // הודעת סיכום ידידותית
      if ("status" in parseData && parseData.status === "needs_ocr") {
        setMsg(`הקובץ נותח אך חסר טקסט (כנראה PDF סרוק). עמודים: ${parseData.pageCount}. נסמן ל־OCR בהמשך.`);
      } else if ("ok" in parseData && parseData.ok) {
        setMsg(`נותח בהצלחה! עמודים: ${(parseData as ParseResultOK).pageCount}, תווים: ${(parseData as ParseResultOK).chars}`);
      } else {
        setMsg("הניתוח הושלם.");
      }
    } catch (e: any) {
      setPhase("error");
      setMsg(e?.message || "שגיאה");
    }
  }

  return (
    <div className="space-y-3">
      {/* קלט קובץ מוחבא לשליטה בעיצוב */}
      <input
        ref={inputRef}
        id="resume-input"
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={onSelect}
      />

      {/* אזור גרירה + כפתור בחירה */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="rounded-2xl border border-dashed p-6 text-center bg-white hover:bg-gray-50 transition"
      >
        <p className="mb-3 text-sm text-slate-600">
          גרור/י לכאן קובץ PDF של קו״ח (עד 5MB)
        </p>
        <Button onClick={() => inputRef.current?.click()} variant="secondary">
          בחר/י קובץ
        </Button>

        {file && (
          <div className="mt-3 text-sm text-slate-700">
            נבחר: <b>{file.name}</b> ({(file.size / 1024).toFixed(1)} KB)
          </div>
        )}
      </div>

      {/* כפתור פעולה אחד: מעלה → מנתח אוטומטית */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={handleUploadAndParse}
          disabled={!file || phase === "uploading" || phase === "parsing"}
        >
          {phase === "uploading"
            ? "מעלה…"
            : phase === "parsing"
            ? "מנתח…"
            : "העלה ונתח אוטומטית"}
        </Button>

        {msg && (
          <span
            className={`text-sm ${
              phase === "error" ? "text-red-600" : "text-slate-700"
            }`}
          >
            {msg}
          </span>
        )}
      </div>

      {/* תקציר תוצאה */}
      {result && "ok" in result && result.ok && "resumeId" in result && (
        <div className="rounded-lg border p-3 bg-white text-sm text-slate-700">
          {"status" in result && result.status === "needs_ocr" ? (
            <>
              <div><b>סטטוס:</b> דרוש OCR</div>
              <div>עמודים: {result.pageCount}</div>
            </>
          ) : (
            <>
              <div><b>תוצאה:</b> resumeId: {(result as ParseResultOK).resumeId}</div>
              <div>עמודים: {(result as ParseResultOK).pageCount}</div>
              <div>תווים: {(result as ParseResultOK).chars}</div>
            </>
          )}
        </div>
      )}

      <p className="text-xs text-slate-500">
        טיפ: אנחנו שומרים זמנית בתיקיית Temp לצורך ניתוח בלבד; אחר כך נמחק. לפרודקשן נעביר לאחסון ענן.
      </p>
    </div>
  );
}
