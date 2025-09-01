// components/JobsFilters.tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export type JobsQuery = {
  q?: string;
  location?: string;
  skill?: string; // נורמליזציה ל-lowercase תעשה בצד הקורא
};

export default function JobsFilters({
  onChange,
  initial = {},
  live = true,          // עדכון חי — כברירת מחדל
  showActions = false,  // ← חדש: ברירת מחדל לכבות את הכפתורים
}: {
  onChange: (q: JobsQuery) => void;
  initial?: JobsQuery;
  live?: boolean;
  showActions?: boolean;
}) {
  const [q, setQ] = useState(initial.q ?? "");
  const [location, setLocation] = useState(initial.location ?? "");
  const [skill, setSkill] = useState(initial.skill ?? "");

  // סנכרון עם initial (מ־URL)
  useEffect(() => { setQ(initial.q ?? ""); }, [initial.q]);
  useEffect(() => { setLocation(initial.location ?? ""); }, [initial.location]);
  useEffect(() => { setSkill(initial.skill ?? ""); }, [initial.skill]);

  // דיווח חי בכל שינוי שדה (ה-debounce מתבצע בעמוד)
  useEffect(() => {
    if (!live) return;
    onChange({ q, location, skill });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, location, skill, live]);

  function submit() {
    onChange({ q, location, skill });
  }

  function reset() {
    setQ("");
    setLocation("");
    setSkill("");
    onChange({ q: "", location: "", skill: "" });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") submit();
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col">
        <label className="text-xs text-slate-500">חיפוש חופשי</label>
        <input
          className="border rounded-md px-2 py-1"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="כותרת / חברה / תיאור"
          aria-label="חיפוש חופשי"
        />
      </div>

      <div className="flex flex-col">
        <label className="text-xs text-slate-500">מיקום</label>
        <input
          className="border rounded-md px-2 py-1"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Tel Aviv / Remote"
          aria-label="מיקום"
        />
      </div>

      <div className="flex flex-col">
        <label className="text-xs text-slate-500">Skill</label>
        <input
          className="border rounded-md px-2 py-1"
          value={skill}
          onChange={(e) => setSkill(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="react / postgres / docker"
          aria-label="Skill"
        />
      </div>

      {showActions && (
        <div className="flex items-center gap-2">
          <Button onClick={submit}>סנן</Button>
          <Button variant="ghost" onClick={reset}>
            נקה
          </Button>
        </div>
      )}
    </div>
  );
}
