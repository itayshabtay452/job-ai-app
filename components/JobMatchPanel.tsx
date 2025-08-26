"use client";

import * as React from "react";

type Props = { jobId: string };

type MatchResponse =
  | {
      ok: true;
      score: number;
      reasons: string[];
      breakdown: {
        matched: string[];
        missing: string[];
        extra: string[];
        coverage: number | null;
      };
    }
  | { ok: false; error: string }; // 404/422 שאנחנו מחזירים ידנית

export default function JobMatchPanel({ jobId }: Props) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [score, setScore] = React.useState<number | null>(null);
  const [reasons, setReasons] = React.useState<string[]>([]);
  const [coverage, setCoverage] = React.useState<number | null>(null);
  const [matched, setMatched] = React.useState<string[]>([]);
  const [missing, setMissing] = React.useState<string[]>([]);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/jobs/${jobId}/match`, {
        method: "GET",
        // בדפדפן, בקשת same-origin כבר שולחת cookies.
        // credentials: "same-origin",
      });

      // 401 מגיע מ-withUser בפורמט { error: "unauthorized" }
      if (res.status === 401) {
        const j = await res.json().catch(() => ({} as any));
        throw new Error(j?.error || "צריך להתחבר (401)");
      }

      if (!res.ok) {
        const j: MatchResponse = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }) as any);
        // ממפים הודעות שגיאה שלנו לשפה ידידותית למשתמש:
        if (!j.ok) {
          if (j.error === "JOB_NOT_FOUND") throw new Error("המשרה לא נמצאה (404).");
          if (j.error === "NO_RESUME") throw new Error("לא נמצא רזומה למשתמש (422). העלה קו״ח והריץ Analyze.");
          if (j.error === "NO_CANDIDATE_SKILLS") throw new Error("לא נמצאו סקילז בקו״ח (422). הרץ Analyze שוב.");
          throw new Error(j.error || `שגיאת שרת (${res.status})`);
        }
        // אם מסיבה כלשהי res.ok=false אבל ok=true — ניפול ל-catch
        throw new Error(`שגיאה לא צפויה (${res.status})`);
      }

      const data: MatchResponse = await res.json();
      if (!("ok" in data) || !data.ok) {
        throw new Error((data as any)?.error || "תשובה לא תקינה מהשרת");
      }

      setScore(data.score);
      setReasons(Array.isArray(data.reasons) ? data.reasons : []);
      setCoverage(data.breakdown?.coverage ?? null);
      setMatched(Array.isArray(data.breakdown?.matched) ? data.breakdown.matched : []);
      setMissing(Array.isArray(data.breakdown?.missing) ? data.breakdown.missing : []);
    } catch (e: any) {
      setError(e?.message || "נכשל בטעינת ציון התאמה");
      setScore(null);
      setReasons([]);
      setCoverage(null);
      setMatched([]);
      setMissing([]);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mt-6 rounded-2xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">ציון התאמה למשרה</h3>
        <button
          onClick={load}
          className="text-sm rounded-md border px-3 py-1 hover:bg-muted transition"
          aria-label="רענון חישוב התאמה"
        >
          רענן
        </button>
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground">טוען ציון התאמה…</div>
      )}

      {!loading && error && (
        <div className="text-sm">
          <div className="text-red-600 font-medium">שגיאה: {error}</div>
          <div className="text-xs text-muted-foreground mt-1">
            טיפ: ודא שאתה מחובר, שיש Job קיים, ושב־Resume שלך יש skills (לאחר Analyze).
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold">{score}</span>
            {coverage != null ? (
              <span className="text-sm text-muted-foreground">
                כיסוי: {(coverage * 100).toFixed(0)}%
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                המשרה ללא דרישות מוצהרות (ברירת מחדל 50)
              </span>
            )}
          </div>

          {reasons.length > 0 && (
            <ul className="list-disc ms-5 text-sm">
              {reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium mb-1">סקילז תואמים</div>
              <div className="flex flex-wrap gap-2">
                {matched.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  matched.map((s) => (
                    <span key={s} className="rounded-full border px-2 py-1 text-xs">
                      {s}
                    </span>
                  ))
                )}
              </div>
            </div>
            <div>
              <div className="font-medium mb-1">סקילז חסרים</div>
              <div className="flex flex-wrap gap-2">
                {missing.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  missing.map((s) => (
                    <span key={s} className="rounded-full border px-2 py-1 text-xs">
                      {s}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
