// app/jobs/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import JobsFilters, { JobsQuery } from "@/components/JobsFilters";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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
  // --- state בסיסי לאינדוקציה ---
  const [query, setQuery] = useState<JobsQuery>({});
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10); // אפשר לשנות בהמשך דרך UI
  const [items, setItems] = useState<JobItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // כשהפילטרים משתנים → חוזרים לעמוד 1
  useEffect(() => {
    setPage(1);
  }, [JSON.stringify(query)]);

  // בניית מחרוזת קוורי יציבה
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (query.q) p.set("q", query.q.trim());
    if (query.location) p.set("location", query.location.trim());
    if (query.skill) p.set("skill", query.skill.trim().toLowerCase()); // skills נשמרו כ-lowercase
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    return p.toString();
  }, [query, page, pageSize]);

  // טעינת נתונים מה-API
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

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">משרות</h1>

      {/* פילטרים */}
      <JobsFilters onChange={setQuery} initial={query} />

      {/* פס סטטוס קצר */}
      <div className="flex items-center justify-between text-sm text-slate-600">
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

      {/* רשימה */}
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
              {job.location && (
                <span className="ml-auto text-sm text-slate-500">{job.location}</span>
              )}
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

        {!loading && !err && items.length === 0 && (
          <li className="text-slate-500">לא נמצאו משרות תואמות.</li>
        )}
      </ul>
    </main>
  );
}
