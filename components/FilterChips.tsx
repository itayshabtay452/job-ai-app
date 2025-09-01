// components/FilterChips.tsx
"use client";

import * as React from "react";
import { X } from "lucide-react";
import type { JobsQuery } from "@/components/JobsFilters";

type Props = {
  query: JobsQuery;
  onChange: (q: JobsQuery) => void;
  className?: string;
};

type Entry = { key: keyof JobsQuery; label: string; value: string };

export default function FilterChips({ query, onChange, className }: Props) {
  // בונים רשימת פילטרים פעילים (רק ערכים לא-ריקים)
  const entries: Entry[] = [];
  if (query.q?.trim()) entries.push({ key: "q", label: "חיפוש", value: query.q.trim() });
  if (query.location?.trim()) entries.push({ key: "location", label: "מיקום", value: query.location.trim() });
  if (query.skill?.trim()) entries.push({ key: "skill", label: "Skill", value: query.skill.trim() });

  if (entries.length === 0) return null;

  function removeOne(key: keyof JobsQuery) {
    const next: JobsQuery = { ...query, [key]: "" };
    onChange(next);
  }

  function clearAll() {
    onChange({}); // מחזיר למצב התחלתי; העמודה תסנכרן URL ותאפס page ל-1
  }

  return (
    <div className={["flex flex-wrap items-center gap-2", className].filter(Boolean).join(" ")}>
      {entries.map(({ key, label, value }) => (
        <button
          key={key}
          type="button"
          onClick={() => removeOne(key)}
          className="group inline-flex items-center gap-1 rounded-full border bg-slate-50 px-3 py-1 text-xs hover:bg-slate-100 transition"
          aria-label={`הסר פילטר ${label}: ${value}`}
          title={`הסר ${label}`}
        >
          <span className="text-slate-700">
            <span className="font-medium">{label}:</span> {value}
          </span>
          <X className="size-3.5 text-slate-500 group-hover:text-slate-700" aria-hidden="true" />
        </button>
      ))}

      {/* נקה הכל */}
      <button
        type="button"
        onClick={clearAll}
        className="ml-1 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs hover:bg-slate-100 transition"
        aria-label="נקה את כל הפילטרים"
        title="נקה את כל הפילטרים"
      >
        נקה הכל
      </button>
    </div>
  );
}
