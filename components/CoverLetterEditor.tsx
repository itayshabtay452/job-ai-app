"use client";

import * as React from "react";

type Props = { jobId: string; maxWords?: number };

// Utility קטן לספירת מילים
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

  // טען טיוטה קיימת
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

  React.useEffect(() => { void load(); }, [load]);

  // יצירה אוטומטית עם AI
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

  // שמירה ידנית
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
      // אפשר להראות toast בעתיד; כרגע שקט
    } catch (e: any) {
      setError(e?.message || "נכשל בשמירת טיוטה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8 rounded-2xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">מכתב פנייה (טיוטה)</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onGenerate}
            disabled={generating}
            className="text-sm rounded-md border px-3 py-1 hover:bg-muted transition disabled:opacity-50"
          >
            {generating ? "מייצר…" : "צור מכתב אוטומטי"}
          </button>
          <button
            onClick={onSave}
            disabled={saving || overLimit}
            className="text-sm rounded-md border px-3 py-1 hover:bg-muted transition disabled:opacity-50"
          >
            {saving ? "שומר…" : "שמור טיוטה"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">טוען טיוטה…</div>
      ) : (
        <>
          {error && <div className="text-sm text-red-600">שגיאה: {error}</div>}

          <textarea
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
            <div className="text-xs text-red-600">
              הטיוטה חורגת ממגבלת המילים — קיצור נדרש לפני שמירה.
            </div>
          )}
        </>
      )}
    </div>
  );
}
