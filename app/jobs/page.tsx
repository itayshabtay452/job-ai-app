"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import JobsFilters, { JobsQuery } from "@/components/JobsFilters";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { useDebounce } from "@/hooks/useDebounce";
import FilterChips from "@/components/FilterChips";
import MatchBadge from "@/components/MatchBadge";


type JobItem = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  skillsRequired: string[];
  url: string | null;
  createdAt: string; // ISO
};

type ListResp = {
  ok: boolean;
  total: number;
  page: number;
  pageSize: number;
  items: JobItem[];
  error?: string;
};

export default function JobsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // --- קריאה ראשונית מה-URL (שומר על שיתוף/רענון) ---
  const [query, setQuery] = useState<JobsQuery>(() => ({
    q: searchParams.get("q") ?? "",
    location: searchParams.get("location") ?? "",
    skill: searchParams.get("skill") ?? "",
  }));
  const [page, setPage] = useState<number>(() => {
    const p = Number(searchParams.get("page") ?? "1");
    return Number.isFinite(p) && p >= 1 ? p : 1;
  });
  const [pageSize] = useState(10);

  // --- Debounce על הפילטרים בלבד ---
  const debouncedQuery = useDebounce(query, 350);

  const [items, setItems] = useState<JobItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // --- בניית מחרוזת קוורי יציבה (מהערכים ה"סופיים": debouncedQuery + page) ---
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedQuery.q) p.set("q", debouncedQuery.q.trim());
    if (debouncedQuery.location) p.set("location", debouncedQuery.location.trim());
    if (debouncedQuery.skill) p.set("skill", debouncedQuery.skill.trim().toLowerCase());
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    return p.toString();
  }, [debouncedQuery, page, pageSize]);

  // --- סנכרון ל-URL בכל שינוי (replace כדי לא לזהם היסטוריה) ---
  useEffect(() => {
    router.replace(`/jobs?${qs}`);
  }, [qs, router]);

  // --- טעינת נתונים מה-API בכל שינוי של qs ---
  useEffect(() => {
    let abort = false;
    setLoading(true);
    setErr(null);

    fetch(`/api/jobs/list?${qs}`)
      .then(async (r) => {
        const data: ListResp = await r.json();
        if (!r.ok || !data.ok) throw new Error(data?.error || "Failed to load jobs");
        if (!abort) {
          setItems(data.items);
          setTotal(data.total);
        }
      })
      .catch((e) => {
        if (!abort) setErr(e?.message || "Error");
      })
      .finally(() => {
        if (!abort) setLoading(false);
      });

    return () => {
      abort = true;
    };
  }, [qs]);

  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < maxPage;

  // --- כשמשנים פילטרים ידנית, חזרה לעמוד 1 ---
  function handleFiltersChange(next: JobsQuery) {
    setQuery(next);
    setPage(1);
  }

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">משרות</h1>

      {/* פילטרים (עדיין עם כפתור "סנן"/"נקה"; אנחנו גם מאזינים ל-debounce) */}
      <JobsFilters onChange={handleFiltersChange} initial={query} live={true} showActions={false} />
      <FilterChips query={query} onChange={handleFiltersChange} className="-mt-2" />

      {/* פס סטטוס קצר + פאג’ינציה */}
      <div className="flex items-center justify-between text-sm text-slate-600" aria-live="polite">
        <div>
          {loading ? "טוען…" : `נמצאו ${total} משרות`}
          {err && <span className="text-red-600"> · שגיאה: {err}</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={!canPrev || loading}
            onClick={() => canPrev && setPage((p) => p - 1)}
          >
            הקודם
          </Button>
          <span>
            עמוד {page} מתוך {maxPage}
          </span>
          <Button
            variant="outline"
            disabled={!canNext || loading}
            onClick={() => canNext && setPage((p) => p + 1)}
          >
            הבא
          </Button>
        </div>
      </div>

      {/* --- Loading skeletons --- */}
      {loading && (
        <ul className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="rounded-xl border bg-white p-4 space-y-3">
              <div className="flex items-baseline gap-2">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-24" />
                <div className="ml-auto">
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Skeleton key={j} className="h-6 w-16 rounded-full" />
                ))}
              </div>
              <Skeleton className="h-4 w-24" />
            </li>
          ))}
        </ul>
      )}

      {/* --- Error --- */}
      {!loading && err && (
        <ErrorState
          message={err}
          onRetry={() => {
            // “רענון” מהיר — שינוי page לטריגר fetch
            setPage((p) => p);
          }}
        />
      )}

      {/* --- Empty --- */}
      {!loading && !err && items.length === 0 && (
        <EmptyState
          title="לא נמצאו משרות תואמות"
          description="נסה לשנות/להסיר פילטרים או לחפש ביטויים כלליים יותר."
          action={
            <Button variant="outline" onClick={() => handleFiltersChange({})}>
              נקה את כל הפילטרים
            </Button>
          }
        />
      )}

      {/* --- Content --- */}
      {!loading && !err && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((job) => (
            <li key={job.id} className="rounded-xl border bg-white p-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <h3 className="text-lg font-semibold">
                  <Link href={`/jobs/${job.id}`} className="hover:underline">
                    {job.title}
                  </Link>
                </h3>
                <span className="text-slate-500">— {job.company}</span>

                <div className="ml-auto flex items-center gap-2">
                  <MatchBadge jobId={job.id} />
                  {job.location && (
                    <span className="text-sm text-slate-500">{job.location}</span>
                  )}
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {job.skillsRequired.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border px-2 py-0.5 text-xs bg-slate-50"
                  >
                    {s}
                  </span>
                ))}
              </div>

              {job.url && (
                <div className="mt-2">
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 underline"
                  >
                    קישור למשרה
                  </a>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
