"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";

export default function ResumeUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  function validate(f: File) {
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setMessage("נא לבחור קובץ PDF בלבד");
      return false;
    }
    if (f.size > 5 * 1024 * 1024) {
      setMessage("קובץ גדול מדי (מקסימום 5MB)");
      return false;
    }
    return true;
  }

  function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!validate(f)) return setFile(null);
    setMessage("");
    setFile(f);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!validate(f)) return setFile(null);
    setMessage("");
    setFile(f);
  }

  async function onUpload() {
    if (!file) return;
    setStatus("uploading");
    setMessage("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/resume/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "שגיאה בהעלאה");
      setStatus("done");
      setMessage(`עלה בהצלחה (id: ${data.id}, ${(file.size / 1024).toFixed(1)} KB)`);
      // אם תרצה: ננקה את הבחירה
      // setFile(null);
      // inputRef.current?.value = "";
    } catch (e: any) {
      setStatus("error");
      setMessage(e?.message || "שגיאה");
    }
  }

  return (
    <div className="space-y-3">
      {/* קלט קובץ מוחבא לגמרי, כדי לשלוט בעיצוב */}
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

      <div className="flex items-center gap-2">
        <Button onClick={onUpload} disabled={!file || status === "uploading"}>
          {status === "uploading" ? "מעלה..." : "העלה קו\"ח"}
        </Button>
        {message && (
          <span
            className={`text-sm ${
              status === "error" ? "text-red-600" : "text-slate-700"
            }`}
          >
            {message}
          </span>
        )}
      </div>

      <p className="text-xs text-slate-500">
        טיפ: אנחנו שומרים זמנית בתיקיית Temp כדי לנתח בהמשך. בפרודקשן נעביר לאחסון ענן.
      </p>
    </div>
  );
}
