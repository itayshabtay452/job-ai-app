"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";

type ParseResultOK = { ok: true; resumeId: string; pageCount: number; chars: number };
type ParseResultNeedsOCR = { ok: true; id: string; status: "needs_ocr"; pageCount: number };
type ParseResult = ParseResultOK | ParseResultNeedsOCR | { error: string };

type ProfileResultOK = { ok: true; resumeId: string; profile: any; yearsExp: number };
type ProfileResult = ProfileResultOK | { error: string };

export default function ResumeUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "parsing" | "analyzing" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string>("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [profile, setProfile] = useState<ProfileResultOK["profile"] | null>(null);
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

  function resetView() {
    setPhase("idle");
    setMsg("");
    setParseResult(null);
    setProfile(null);
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

  async function handleUploadParseAnalyze() {
    if (!file) return;
    try {
      // 1) Upload
      setPhase("uploading");
      setMsg("");
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch("/api/resume/upload", { method: "POST", body: fd });
      const upData = await upRes.json();
      if (!upRes.ok) {
        if (upRes.status === 401) throw new Error("נדרש להתחבר כדי להעלות קובץ");
        throw new Error(upData?.error || "שגיאה בהעלאה");
      }
      const tempId: string = upData.id;
      setMsg(`העלאה הושלמה (id: ${tempId}). ממשיכים לניתוח…`);

      // 2) Parse
      setPhase("parsing");
      const parseRes = await fetch("/api/resume/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tempId }),
      });
      const parseData: ParseResult = await parseRes.json();
      if (!parseRes.ok) {
        const err = (parseData as any)?.error || "שגיאה בניתוח";
        if (parseRes.status === 401) throw new Error("נדרש להתחבר כדי לנתח קובץ");
        throw new Error(err);
      }

      setParseResult(parseData);

      if ("status" in parseData && parseData.status === "needs_ocr") {
        setMsg(`נותח אך ללא שכבת טקסט (כנראה PDF סרוק). עמודים: ${parseData.pageCount}.`);
        setPhase("done");
        inputRef.current && (inputRef.current.value = "");
        return;
      } else if ("ok" in parseData && parseData.ok) {
        setMsg(`נותח בהצלחה. עמודים: ${(parseData as ParseResultOK).pageCount}. ממשיכים ל-AI…`);
      }

      // 3) Analyze (AI)
      setPhase("analyzing");
      const aiRes = await fetch("/api/resume/analyze", { method: "POST" });
      const aiData: ProfileResult = await aiRes.json();
      if (!aiRes.ok) {
        const err = (aiData as any)?.error || "שגיאה בניתוח AI";
        if (aiRes.status === 401) throw new Error("נדרש להתחבר כדי להפעיל AI");
        throw new Error(err);
      }

      setProfile((aiData as ProfileResultOK).profile);
      setMsg("פרופיל מועמד הופק בהצלחה!");
      setPhase("done");
      inputRef.current && (inputRef.current.value = "");
    } catch (e: any) {
      setPhase("error");
      setMsg(e?.message || "שגיאה");
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        id="resume-input"
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={onSelect}
      />

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="rounded-2xl border border-dashed p-6 text-center bg-white hover:bg-gray-50 transition"
      >
        <p className="mb-3 text-sm text-slate-600">גרור/י לכאן קובץ PDF של קו״ח (עד 5MB)</p>
        <Button onClick={() => inputRef.current?.click()} variant="secondary">בחר/י קובץ</Button>
        {file && (
          <div className="mt-3 text-sm text-slate-700">
            נבחר: <b>{file.name}</b> ({(file.size / 1024).toFixed(1)} KB)
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={handleUploadParseAnalyze}
          disabled={!file || phase === "uploading" || phase === "parsing" || phase === "analyzing"}
        >
          {phase === "uploading" ? "מעלה…"
            : phase === "parsing" ? "מנתח PDF…"
            : phase === "analyzing" ? "מחלץ פרופיל AI…"
            : "העלה → ניתוח PDF → AI"}
        </Button>

        {msg && (
          <span className={`text-sm ${phase === "error" ? "text-red-600" : "text-slate-700"}`}>
            {msg}
          </span>
        )}
      </div>

      {/* תקציר parse */}
      {parseResult && "ok" in parseResult && parseResult.ok && (
        <div className="rounded-lg border p-3 bg-white text-sm text-slate-700">
          {"status" in parseResult && (parseResult as any).status === "needs_ocr" ? (
            <>
              <div><b>סטטוס PDF:</b> דרוש OCR</div>
              <div>עמודים: {(parseResult as any).pageCount}</div>
            </>
          ) : (
            <>
              <div><b>Resume:</b> {(parseResult as ParseResultOK).resumeId}</div>
              <div>עמודים: {(parseResult as ParseResultOK).pageCount}</div>
              <div>תווים: {(parseResult as ParseResultOK).chars}</div>
            </>
          )}
        </div>
      )}

      {/* פרופיל AI */}
      {profile && (
        <div className="rounded-lg border p-3 bg-white text-sm text-slate-700 space-y-2">
          <div><b>Skills:</b> {(profile.skills || []).join(", ")}</div>
          <div><b>Tools:</b> {(profile.tools || []).join(", ")}</div>
          <div><b>DBs:</b> {(profile.dbs || []).join(", ")}</div>
          <div><b>Years:</b> {profile.years}</div>
          <div className="space-y-1">
            <b>Highlights:</b>
            <ul className="list-disc pl-5">
              {(profile.highlights || []).map((h: string, i: number) => <li key={i}>{h}</li>)}
            </ul>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500">
        טיפ: אנחנו שומרים זמנית בתיקיית Temp לצורך ניתוח בלבד; אחר כך נמחק. לפרודקשן—נעדיף אחסון ענן ו-queue ל-PDF כבדים.
      </p>
    </div>
  );
}
