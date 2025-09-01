// components/CoverLetterEditor.tsx
"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

type Props = { jobId: string; maxWords?: number };

function countWords(s: string) {
  return (s ?? "").trim().split(/\s+/).filter(Boolean).length;
}

export default function CoverLetterEditor({ jobId, maxWords = 220 }: Props) {
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [text, setText] = React.useState("");
  const words = countWords(text);
  const overLimit = words > maxWords;

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/cover-letter`, { method: "GET" });
      if (res.status === 401) throw new Error("צריך להתחבר (401).");
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "שגיאה בטעינת הטיוטה.");
      setText(data?.draft?.coverLetter ?? "");
    } catch (e: any) {
      setError(e?.message || "שגיאת טעינה");
      setText("");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function onGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/cover-letter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxWords }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `שגיאת שרת (${res.status})`);
      }
      setText(data.draft.coverLetter ?? "");
    } catch (e: any) {
      setError(e?.message || "נכשל ביצירת מכתב");
    } finally {
      setGenerating(false);
    }
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/cover-letter`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverLetter: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `שגיאת שרת (${res.status})`);
      }
      // אפשר להראות toast בשלב 13.5
    } catch (e: any) {
      setError(e?.message || "נכשל בשמירת טיוטה");
    } finally {
      setSaving(false);
    }
  }

  const busy = loading || generating || saving;

  return (
    <div
      className="mt-8 rounded-2xl border p-4 space-y-3"
      aria-busy={busy ? "true" : "false"}
      aria-live="polite"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">מכתב פנייה (טיוטה)</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onGenerate}
            disabled={generating || loading}
            aria-disabled={generating || loading}
            className="text-sm rounded-md border px-3 py-1 hover:bg-muted transition disabled:opacity-50"
          >
            {generating ? "מייצר…" : "צור מכתב אוטומטי"}
          </button>
          <button
            onClick={onSave}
            disabled={saving || overLimit || loading}
            aria-disabled={saving || overLimit || loading}
            className="text-sm rounded-md border px-3 py-1 hover:bg-muted transition disabled:opacity-50"
          >
            {saving ? "שומר…" : "שמור טיוטה"}
          </button>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading ? (
        <div role="status" className="space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <div className="flex gap-2">
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-7 w-24" />
            </div>
          </div>
          <Skeleton className="h-40 w-full" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      ) : (
        <>
          {error && (
            <div role="alert" className="text-sm text-red-600">
              שגיאה: {error}
            </div>
          )}

          <label htmlFor="cover-letter-textarea" className="sr-only">
            אזור עריכת מכתב פנייה
          </label>
          <textarea
            id="cover-letter-textarea"
            className="w-full min-h-[220px] rounded-md border p-3 text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="לחץ 'צור מכתב אוטומטי' כדי להתחיל, או הדבק טיוטה משלך…"
          />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>מגבלת מילים: {maxWords}</span>
            <span className={overLimit ? "text-red-600 font-medium" : ""}>
              ספירת מילים: {words}{overLimit ? " (חריגה)" : ""}
            </span>
          </div>

          {overLimit && (
            <div className="text-xs text-red-600" role="alert">
              הטיוטה חורגת ממגבלת המילים — קיצור נדרש לפני שמירה.
            </div>
          )}
        </>
      )}
    </div>
  );
}
