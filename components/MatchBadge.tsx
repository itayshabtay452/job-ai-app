// components/MatchBadge.tsx
"use client";

import * as React from "react";
import { signIn, useSession } from "next-auth/react";
import { Skeleton } from "@/components/ui/skeleton";

// --- Cache ותור גלובליים למניעת כפילויות ועומס ---
type CacheEntry =
  | { kind: "ok"; score: number }
  | { kind: "unauth" }
  | { kind: "err"; msg: string };

const cache = new Map<string, CacheEntry>();

const MAX_CONCURRENT = 3;
let running = 0;
const queue: Array<() => Promise<void>> = [];

function runNext() {
  if (running >= MAX_CONCURRENT) return;
  const task = queue.shift();
  if (!task) return;
  running++;
  task()
    .catch(() => void 0)
    .finally(() => {
      running--;
      runNext();
    });
}

function enqueue(task: () => Promise<void>) {
  queue.push(task);
  runNext();
}

function colorClasses(score: number) {
  if (score >= 80) return "border-emerald-200 bg-emerald-100 text-emerald-700";
  if (score >= 60) return "border-amber-200 bg-amber-100 text-amber-700";
  if (score >= 40) return "border-orange-200 bg-orange-100 text-orange-700";
  return "border-red-200 bg-red-100 text-red-700";
}

export default function MatchBadge({ jobId }: { jobId: string }) {
  const { status } = useSession(); // "authenticated" | "unauthenticated" | "loading"
  const [entry, setEntry] = React.useState<CacheEntry | null>(() => cache.get(jobId) ?? null);
  const [visible, setVisible] = React.useState(false);

  // שים לב: ref ל-SPAN בלבד (לא ל-button)
  const ref = React.useRef<HTMLSpanElement | null>(null);

  // טעינה עצלה: נזהה מתי האלמנט נכנס ל-viewport
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (obs) => {
        for (const o of obs) {
          if (o.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "100px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // טעינת הציון (פעם אחת לכל jobId) כשנראה לעין
  React.useEffect(() => {
    if (!visible) return;

    // אם כבר יש מטמון — נשתמש בו
    const cached = cache.get(jobId);
    if (cached) {
      setEntry(cached);
      return;
    }

    // אם יודעים שלא מחובר — לא שולחים בקשה, רק מראים CTA
    if (status === "unauthenticated") {
      const e: CacheEntry = { kind: "unauth" };
      cache.set(jobId, e);
      setEntry(e);
      return;
    }

    // אם ה-session עדיין נטען — נחכה לרינדור הבא
    if (status === "loading") return;

    enqueue(async () => {
      try {
        const r = await fetch(`/api/jobs/${jobId}/match`, { method: "GET" });
        if (r.status === 401) {
          const e: CacheEntry = { kind: "unauth" };
          cache.set(jobId, e);
          setEntry(e);
          return;
        }
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j?.ok) {
          const e: CacheEntry = { kind: "err", msg: j?.error || `HTTP ${r.status}` };
          cache.set(jobId, e);
          setEntry(e);
          return;
        }
        const score: number = j.score ?? 0;
        const e: CacheEntry = { kind: "ok", score };
        cache.set(jobId, e);
        setEntry(e);
      } catch (err: any) {
        const e: CacheEntry = { kind: "err", msg: err?.message || "fetch error" };
        cache.set(jobId, e);
        setEntry(e);
      }
    });
  }, [visible, jobId, status]);

  // --- UI ---

  // שלד התחלתי עד שיש החלטה/מטמון
  if (!entry) {
    return (
      <span ref={ref} className="inline-flex">
        <Skeleton className="h-6 w-12 rounded-full" />
      </span>
    );
  }

  // לא מחובר: עוטפים בכוונה את הכפתור ב-span עם ה-ref כדי למנוע בעיית טיפוס
  if (entry.kind === "unauth") {
    return (
      <span ref={ref} className="inline-flex">
        <button
          onClick={() => signIn("github")}
          className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50 transition"
          title="התחבר כדי לראות ציון התאמה"
        >
          התחברות לציון
        </button>
      </span>
    );
  }

  if (entry.kind === "err") {
    return (
      <span
        ref={ref}
        className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] text-slate-700"
        title={entry.msg}
      >
        שגיאה
      </span>
    );
  }

  // kind === "ok"
  return (
    <span
      ref={ref}
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        colorClasses(entry.score),
      ].join(" ")}
      title={`ציון התאמה: ${entry.score}`}
      aria-label={`ציון התאמה: ${entry.score}`}
    >
      התאמה {entry.score}
    </span>
  );
}
