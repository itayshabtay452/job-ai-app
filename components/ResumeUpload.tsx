// components/ResumeUpload.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Upload,
  FileUp,
  FileText,
  Wand2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";
import { signIn } from "next-auth/react";

type ParseResultOK = { ok: true; resumeId: string; pageCount: number; chars: number };
type ParseResultNeedsOCR = { ok: true; id: string; status: "needs_ocr"; pageCount: number };
type ParseResult = ParseResultOK | ParseResultNeedsOCR | { error: string };

type ProfileResultOK = { ok: true; resumeId: string; profile: any; yearsExp: number };
type ProfileResult = ProfileResultOK | { error: string };

type Phase = "idle" | "uploading" | "parsing" | "analyzing" | "done" | "error";

export default function ResumeUpload() {
  // --- state ---
  const [file, setFile] = React.useState<File | null>(null);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [msg, setMsg] = React.useState<string>("");
  const [parseResult, setParseResult] = React.useState<ParseResult | null>(null);
  const [profile, setProfile] = React.useState<ProfileResultOK["profile"] | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // --- utils ---
  function kib(n: number) {
    return `${(n / 1024).toFixed(1)} KB`;
  }
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

  // --- handlers: select/drag ---
  function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!validate(f)) return setFile(null);
    resetView();
    setFile(f);
  }
  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!validate(f)) return setFile(null);
    resetView();
    setFile(f);
  }

async function handleUploadParseAnalyze() {
  if (!file) return;
  try {
    // 1) Upload + Parse (באותו ראוט)
    setPhase("uploading");
    setMsg("");
    const fd = new FormData();
    fd.append("file", file);

    const upRes = await fetch("/api/resume/upload", { method: "POST", body: fd });
    const upData = await upRes.json();
    if (!upRes.ok || !upData?.ok) {
      if (upRes.status === 401) throw new Error("נדרש להתחבר כדי להעלות קובץ (401)");
      throw new Error(upData?.error || "שגיאה בהעלאה/ניתוח PDF");
    }

    // לשמור תוצאת "parse" למסך התקציר
    setParseResult(upData);

    if (upData.status === "needs_ocr") {
      setMsg(`נותח אך ללא שכבת טקסט (כנראה PDF סרוק). עמודים: ${upData.pageCount}.`);
      setPhase("done");
      inputRef.current && (inputRef.current.value = "");
      return;
    } else {
      setMsg(`נותח בהצלחה. עמודים: ${upData.pageCount}. ממשיכים ל-AI…`);
    }

    // 2) Analyze (AI)
    setPhase("analyzing");
    const aiRes = await fetch("/api/resume/analyze", { method: "POST" });
    const aiData = await aiRes.json();
    if (!aiRes.ok || !aiData?.ok) {
      if (aiRes.status === 401) throw new Error("נדרש להתחבר כדי להפעיל AI (401)");
      throw new Error(aiData?.error || "שגיאה בניתוח AI");
    }

    setProfile(aiData.profile);
    setMsg("פרופיל מועמד הופק בהצלחה!");
    setPhase("done");
    inputRef.current && (inputRef.current.value = "");
  } catch (e: any) {
    setPhase("error");
    setMsg(e?.message || "שגיאה");
  }
}


  const busy = phase === "uploading" || phase === "parsing" || phase === "analyzing";

  return (
    <div className="space-y-4">
      {/* קלט קובץ חבוי */}
      <input
        ref={inputRef}
        id="resume-input"
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={onSelect}
      />

      {/* Dropzone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="אזור העלאת קובץ קורות חיים בפורמט PDF"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        className={[
          "rounded-2xl border border-dashed p-6 text-center bg-white transition outline-none",
          dragActive ? "border-primary/60 bg-primary/5" : "hover:bg-gray-50",
          busy ? "opacity-70 pointer-events-none" : "",
        ].join(" ")}
      >
        <div className="flex flex-col items-center gap-2">
          <Upload className="size-6 text-slate-500" aria-hidden="true" />
          <p className="text-sm text-slate-600">
            גרור/י לכאן קובץ PDF של קו״ח (עד 5MB) או{" "}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="underline underline-offset-4 hover:opacity-80"
            >
              בחר/י קובץ
            </button>
          </p>
          {file && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border bg-slate-50 px-3 py-1 text-xs text-slate-700">
              <FileUp className="size-3.5" aria-hidden="true" />
              <span className="truncate max-w-[220px]" title={file.name}>
                {file.name}
              </span>
              <span className="text-slate-500">({kib(file.size)})</span>
              <button
                className="ml-1 inline-flex items-center justify-center rounded-full p-1 hover:bg-slate-100"
                aria-label="נקה קובץ"
                onClick={() => {
                  setFile(null);
                  inputRef.current && (inputRef.current.value = "");
                }}
              >
                <X className="size-3.5 text-slate-500" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* כפתור תהליך + הודעה קצרה */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleUploadParseAnalyze} disabled={!file || busy}>
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              {phase === "uploading"
                ? "מעלה…"
                : phase === "parsing"
                ? "מנתח PDF…"
                : "מחלץ פרופיל AI…"}
            </span>
          ) : (
            "העלה → ניתוח PDF → AI"
          )}
        </Button>

        {/* הודעות מערכת קצרות עם אייקון */}
        {msg && (
          <span
            className={[
              "inline-flex items-center gap-2 text-sm",
              phase === "error" ? "text-red-600" : "text-slate-700",
            ].join(" ")}
            aria-live="polite"
          >
            {phase === "error" ? (
              <AlertCircle className="size-4" />
            ) : phase === "done" ? (
              <CheckCircle2 className="size-4 text-emerald-600" />
            ) : (
              <Loader2 className="size-4 animate-spin text-slate-500" />
            )}
            {msg}
            {/* במצב 401 נציע התחברות */}
            {phase === "error" && /401/.test(msg) && (
              <Button variant="outline" size="sm" onClick={() => signIn("github")} className="ml-1">
                התחבר/י
              </Button>
            )}
          </span>
        )}
      </div>

      {/* Stepper: Upload → Parse → Analyze */}
      <ProgressStepper phase={phase} />

      {/* תקציר parse */}
      {parseResult && "ok" in parseResult && parseResult.ok && (
        <div className="rounded-xl border p-3 bg-white text-sm text-slate-700">
          {"status" in parseResult && (parseResult as any).status === "needs_ocr" ? (
            <>
              <div className="flex items-center gap-2">
                <AlertCircle className="size-4 text-amber-600" />
                <b>סטטוס PDF:</b> דרוש OCR
              </div>
              <div>עמודים: {(parseResult as any).pageCount}</div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-slate-600" />
                <b>Resume:</b> {(parseResult as ParseResultOK).resumeId}
              </div>
              <div>עמודים: {(parseResult as ParseResultOK).pageCount}</div>
              <div>תווים: {(parseResult as ParseResultOK).chars}</div>
            </>
          )}
        </div>
      )}

      {/* פרופיל AI */}
      {phase === "analyzing" && (
        <div className="rounded-xl border p-3 bg-white text-sm text-slate-700 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {profile && (
        <div className="rounded-xl border p-3 bg-white text-sm text-slate-700 space-y-2">
          <div>
            <b>Skills:</b> {(profile.skills || []).join(", ")}
          </div>
          <div>
            <b>Tools:</b> {(profile.tools || []).join(", ")}
          </div>
          <div>
            <b>DBs:</b> {(profile.dbs || []).join(", ")}
          </div>
          <div>
            <b>Years:</b> {profile.years}
          </div>
          <div className="space-y-1">
            <b>Highlights:</b>
            <ul className="list-disc ps-5">
              {(profile.highlights || []).map((h: string, i: number) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500">
        טיפ: אנחנו שומרים זמנית בתיקיית Temp לצורך ניתוח בלבד; לפרודקשן נעדיף אחסון ענן ו־queue ל-PDF
        כבדים. מקרה של <i>needs_ocr</i> יצריך OCR בשלב המשך.
      </p>
    </div>
  );
}

/** Stepper קטן לשלבי התהליך */
function ProgressStepper({ phase }: { phase: Phase }) {
  const steps = [
    { key: "uploading", label: "Upload", icon: Upload },
    { key: "parsing", label: "Parse", icon: FileText },
    { key: "analyzing", label: "Analyze", icon: Wand2 },
  ] as const;

  function stateFor(key: typeof steps[number]["key"]) {
    if (phase === "error") return "error";
    if (phase === "done") return "done";
    if (phase === key) return "active";
    const idx = steps.findIndex((s) => s.key === key);
    const phaseIdx = steps.findIndex((s) => s.key === phase);
    if (phaseIdx === -1) return "idle";
    return idx < phaseIdx ? "done" : "idle";
  }

  return (
    <div className="flex items-center gap-3">
      {steps.map((s, i) => {
        const st = stateFor(s.key);
        const Icon = s.icon;
        return (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={[
                "size-8 grid place-items-center rounded-full border",
                st === "active"
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : st === "done"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : st === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-slate-200 bg-white text-slate-500",
              ].join(" ")}
              title={s.label}
              aria-label={s.label}
            >
              {st === "active" ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
            </div>
            <span className="text-xs text-slate-600">{s.label}</span>
            {i < steps.length - 1 && <div className="w-6 border-t border-dashed border-slate-300" />}
          </div>
        );
      })}
      {phase === "done" && (
        <div className="ms-auto inline-flex items-center gap-1 text-xs text-emerald-700">
          <CheckCircle2 className="size-4" />
          מוכן
        </div>
      )}
      {phase === "error" && (
        <div className="ms-auto inline-flex items-center gap-1 text-xs text-red-700">
          <AlertCircle className="size-4" />
          שגיאה
        </div>
      )}
    </div>
  );
}
